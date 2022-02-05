// Startup -- load Zotero and constants
if (typeof Zotero === 'undefined') {
    Zotero = {};
}
Zotero.DuplicatesMerger = {};

// Preference managers

function getPref(pref) {
    return Zotero.Prefs.get('extensions.duplicatesmerger.' + pref, true);
}

function setPref(pref, value) {
    return Zotero.Prefs.set('extensions.duplicatesmerger.' + pref, value, true);
}

// Startup - initialize plugin
Zotero.DuplicatesMerger.loadURI = function(uri){
    ZoteroPane_Local.loadURI(uri);
};

Zotero.DuplicatesMerger.init = function() {
	this._ignoreFields = ['dateAdded', 'dateModified', 'accessDate'];

    this.noMismatchedItems = 0;
    this.noSkippedItems = 0;
    
    this.lastProcessedItemId = 0;
    this.currentRowCount = 0;
    
    this.isRunning = false;
    this.initialNoItems = 1;

    this.selectedItemsList = [];

    this.stringsBundle = Components.classes['@mozilla.org/intl/stringbundle;1']
    .getService(Components.interfaces.nsIStringBundleService)
    .createBundle('chrome://zoteroduplicatesmerger/locale/duplicatesmerger.properties');
};

Zotero.DuplicatesMerger.getFormattedString = function(stringName, params) {
    try {
        if (params !== undefined){
            if (typeof params != 'object'){
                params = [params];
            }
            return this.stringsBundle.formatStringFromName(stringName, params, params.length);
        }
        else {
            return this.stringsBundle.GetStringFromName(stringName);
        }
    }
    catch (e){
        throw ('Localized string not available for ' + stringName);
    }       
};

// Controls for Tools menu

// *********** Set the checkbox checks, frompref
Zotero.DuplicatesMerger.setCheck = function(type) {
    var pref = getPref(type);
    if (type == 'master'){
        var tools_oldest = document.getElementById("menu_Tools-duplicatesmerger-menu-popup-master-oldest");
        var tools_newest = document.getElementById("menu_Tools-duplicatesmerger-menu-popup-master-newest");
        var tools_creator = document.getElementById("menu_Tools-duplicatesmerger-menu-popup-master-creator");
        tools_oldest.setAttribute("checked", Boolean(pref === "oldest"));
        tools_newest.setAttribute("checked", Boolean(pref === "newest"));
        tools_creator.setAttribute("checked", Boolean(pref === "creator"));
    }
    else if (type == 'typemismatch'){
        var tools_skip = document.getElementById("menu_Tools-duplicatesmerger-menu-popup-typemismatch-skip");
        var tools_master  = document.getElementById("menu_Tools-duplicatesmerger-menu-popup-typemismatch-master");
        tools_skip.setAttribute("checked", Boolean(pref === "skip"));
        tools_master.setAttribute("checked", Boolean(pref === "master"));
    }
};

// *********** Change the checkbox, topref
Zotero.DuplicatesMerger.changePref = function changePref(pref, option) {
    setPref(pref, option);
};

/**
 * Open preference window
 */
Zotero.DuplicatesMerger.openPreferenceWindow = function(paneID, action) {
    var io = {pane: paneID, action: action};
    window.openDialog('chrome://zoteroduplicatesmerger/content/options.xul',
        'duplicatesmerger-pref',
        'chrome,titlebar,toolbar,centerscreen' + Zotero.Prefs.get('browser.preferences.instantApply', true) ? 'dialog=no' : 'modal', io
    );
};

/**
 * Context menu
 */

 Zotero.DuplicatesMerger.showItemsPopup = function() {
    var win = Services.wm.getMostRecentWindow('navigator:browser');
    var isDuplicatesPane = Zotero.getActiveZoteroPane().getCollectionTreeRow().isDuplicates();
    win.ZoteroPane.document.getElementById('duplicatesmerger-itemmenu-bulk').setAttribute('hidden', !isDuplicatesPane);
    win.ZoteroPane.document.getElementById('duplicatesmerger-itemmenu-single').setAttribute('hidden', isDuplicatesPane);
}.bind(Zotero.DuplicatesMerger);

/**
 * Single item merge
 */
Zotero.DuplicatesMerger.smartMerge = function() {    
    var ActivePane = Zotero.getActiveZoteroPane();
    this.mergeSelectedItems(ActivePane, ActivePane.getSelectedItems(), false);
};

/**
 * Bulk merge
 */
Zotero.DuplicatesMerger.mergeSelectedItems = async function(DupPane, items, performMerge){
    // try {
        await DupPane.mergeSelectedItems();
        await new Promise(r => setTimeout(r, 1));

        // Find the master item
        var masterSelectionPreference = getPref("master");
        
        items.sort(function (a, b) {
            return a.dateAdded > b.dateAdded ? 1 : a.dateAdded == b.dateAdded ? 0 : -1;
        });
        
        var masterIndex = 0;
        if (masterSelectionPreference == "newest"){
            masterIndex = items.length - 1;
        }
        // Select as master item the one that has the longest first name author
        else if (masterSelectionPreference == "creator"){
            function getCreatorName(creatorEntry){
                if (creatorEntry.name != null)
                    return creatorEntry.name;
                return creatorEntry.lastName + " " + creatorEntry.firstName;
            }

            // Retrieve the possible alternatives for each property
            var item = items[0];
            var _otherItems = items.concat();
            var alternatives = item.multiDiff(_otherItems, this._ignoreFields);

            // If there are alternatives names for the creators
            if (alternatives["creators"] != null){
                // find the length of the first creator for the first entry
                var longestCreatorsNameLength = 0
                var firstItemValues = item.toJSON();
                for (let creator of firstItemValues.creators){
                    if (creator.creatorType != "author") continue;
                    longestCreatorsNameLength = getCreatorName(creator).length;
                    break;
                }
            
                // go over each item and find if there's a first creator with a longer name
                for (var i = 1 ; i < _otherItems.length ; i++){
                    var alternativeItemValues = _otherItems[i].toJSON();
                    if (alternativeItemValues.creators.length == 0) continue;
                    
                    for (let creator of alternativeItemValues.creators){
                        if (creator.creatorType != "author") continue;
                        
                        var alternativeNameLength = getCreatorName(creator).length;
                        if (alternativeNameLength > longestCreatorsNameLength){
                            longestCreatorsNameLength = alternativeNameLength;
                            masterIndex = i;
                        }
                        break;
                    }
                }
            }
        }
        
        // Select the master item
        if (masterIndex > 0){
            var dateList = document.getElementById('zotero-duplicates-merge-original-date');
            dateList.selectedIndex = masterIndex;

            Zotero_Duplicates_Pane.setMaster(masterIndex);
        }

        // Handle type mismatching between items
        var masterTypeId = items[masterIndex].itemTypeID;
        var isTypeMismatch = false;
        for (let item of items) {
            if (masterTypeId != item.itemTypeID){
                isTypeMismatch = true;
                break;
            }
        }

        if (isTypeMismatch == true){
            var typemismatchPreference = getPref("typemismatch");
            if (typemismatchPreference == "skip"){
                Zotero.DuplicatesMerger.noMismatchedItems += items.length;
                
                return false;
            }
            else if (typemismatchPreference == "master"){
                for (let item of items) {
                    if (masterTypeId != item.itemTypeID){
                        item.setType(masterTypeId);
                    }
                }
                await new Promise(r => setTimeout(r, 200));
            }
        }

        /// Merge Items
        var item = items[masterIndex];
        var _otherItems = items.concat();

		// Add master item's values to the beginning of each set of
		// alternative values so that they're still available if the item box
		// modifies the item
		var alternatives = item.multiDiff(_otherItems, this._ignoreFields);
		if (alternatives) {
            let itemValues = item.toJSON();
            for (let i in alternatives) {
                alternatives[i].unshift(itemValues[i] !== undefined ? itemValues[i] : '');
            }
        
		    var itembox = document.getElementById('zotero-duplicates-merge-item-box');
            for (let param in alternatives){                
                if (param == "creators" || param == "tags" || param == "relations" || param == "collections") continue;
                
                var masterEntryIndex = 0;
                for (let entry in alternatives[param]){
                    if (alternatives[param][entry].length > alternatives[param][masterEntryIndex].length){
                        masterEntryIndex = entry;
                    }
                }

                if (masterEntryIndex > 0){
                    itembox.item.setField(param, alternatives[param][masterEntryIndex]);
                }
            }
            itembox.refresh();
		}
		
        if (performMerge == true)
            Zotero_Duplicates_Pane.merge();

        return true;
};

/**
 * Selects the next available set of duplicated items
 *
 * @param {ZoteroPane} pane
 * @return {Integer}  count of selected items
 * @return {Interger[]}
 */
Zotero.DuplicatesMerger.selectNextDuplicatedItems = function (pane){
    var nextItemIdx = Zotero.DuplicatesMerger.noMismatchedItems + this.noSkippedItems;
    if(pane.itemsView.rowCount > nextItemIdx){
        // find the id of the next available item in the list
        var itemID = pane.itemsView.getRow(nextItemIdx).ref.id;
        
        if (itemID != this.lastProcessedItemId || this.selectedItemsList.length == 0){
            // get the items that have the same ID as the selected one
            var selectedItemsIds = pane.getCollectionTreeRow().ref.getSetItemsByItemID(itemID);
            // if no more than one item exists with the given id (i.e. selected item has no duplicates)
            if (selectedItemsIds.length <= 1){
                // add to the current offset so that the non-duplicated item can be skipped next time
                this.noSkippedItems = this.noSkippedItems + selectedItemsIds.length;
            }
            else{ // if the selected item has duplicates
                // mark the id of the item
                this.lastProcessedItemId = itemID;

                // select all items with that id
                pane.itemsView.selectItems(selectedItemsIds);
                
                // and update the references to the selected items
                this.selectedItemsList = pane.itemsView.getSelectedItems();

                if (this.noSkippedItems > 0)
                    this.noSkippedItems = 0;
                
                return true;
            }
        }
    }
    
    this.selectedItemsList.length = 0;
    this.noSkippedItems = 0;
    return false;
};

/**
 * Initializes a new progress window
 *
 */
Zotero.DuplicatesMerger.createProgressWindow = function(){
    // If there is already a window close it
    if (this.progressWindow) {
        this.progressWindow.close();
    }

    // Create a new window and initialize it
    var iconHeadline = 'chrome://zotero/skin/treesource-duplicates' + (Zotero.hiDPI ? "@2x" : "") + '.png';
    var icon = "chrome://zotero/skin/plus.png";
    this.progressWindow = new Zotero.ProgressWindow({closeOnClick:false});
    this.progressWindow.changeHeadline(this.getFormattedString("general.progressHeaderInitial"), iconHeadline);
    this.progressWindow.progress = new this.progressWindow.ItemProgress(icon);
    this.progressWindow.progress.setProgress(100);
    this.progressWindow.progress.setText(this.getFormattedString("general.progressMsgInitial", [this.initialNoItems]));
    this.progressWindow.show();
};

/**
 * Update the progress window based on the number of items processed
 */
Zotero.DuplicatesMerger.updateProgressWindow = function () {
    var processed = this.initialNoItems - this.currentRowCount + this.noMismatchedItems;
    var percent = Math.round((processed/this.initialNoItems)*100);
    this.progressWindow.progress.setProgress(percent);
    this.progressWindow.progress.setText(this.getFormattedString("general.itemsProcessed", [processed, this.initialNoItems, this.currentRowCount - this.noMismatchedItems]));
    this.progressWindow.show();
};

Zotero.DuplicatesMerger.closeProgressWindow = function (errorNo, header, msg) {
    var iconHeadline = 'chrome://zotero/skin/treesource-duplicates' + (Zotero.hiDPI ? "@2x" : "") + '.png';
    if (errorNo == 0) {
        var icon = "chrome://zotero/skin/cross.png";
        this.progressWindow.changeHeadline(header, iconHeadline);
        this.progressWindow.progress = new this.progressWindow.ItemProgress(icon);
        this.progressWindow.progress.setProgress(100);
        this.progressWindow.progress.setText(msg);
        this.progressWindow.show();
        this.progressWindow.startCloseTimer(5000);
    }
    else {
        var icon = "chrome://zotero/skin/tick.png";
        this.progressWindow.changeHeadline(header, iconHeadline);
        this.progressWindow.addDescription(msg);
        this.progressWindow.progress = new this.progressWindow.ItemProgress(icon);
        this.progressWindow.show();
        this.progressWindow.startCloseTimer(5000);
    }
};

/**
 * Main plugin function: Merge duplicate items
 */
Zotero.DuplicatesMerger.mergeDuplicates = async function () {
    // Prevent the merger to run again, if it's already running
    if(this.isRunning == true)
    {
        return;
    }

    // Keep reference of the duplicates pane
    var DuplicatesPane = Zotero.getActiveZoteroPane();
    if (!DuplicatesPane.getCollectionTreeRow().isDuplicates()){
        return;
    }

    // Notify start of the duplicate merger
    this.isRunning = true;

    var delayBetweenCalls = getPref("delay");

    // Intialize progress / acitve item counters
    this.initialNoItems = DuplicatesPane.itemsView.rowCount;
    this.noMismatchedItems = 0;
    this.noSkippedItems = 0;
    
    this.lastProcessedItemId = 0;
    this.currentRowCount = DuplicatesPane.itemsView.rowCount;

    this.selectedItemsList = [];

    await DuplicatesPane.getCollectionTreeRow().getSearchObject();

    // Create Progress Windows
    this.createProgressWindow();

    // Retrive the first items from the list
    this.selectNextDuplicatedItems(DuplicatesPane);
    
    // var errorCount = 0;
    this.errorCount = 0;

    // Go while the duplicates pane is still the selected pane,
    // there are still items to be processed, and plugin hasn't timed out
    while (DuplicatesPane.getCollectionTreeRow().isDuplicates() && DuplicatesPane.itemsView.rowCount > (Zotero.DuplicatesMerger.noMismatchedItems+1) && this.errorCount <= 5) {
        try{
            this.currentRowCount = DuplicatesPane.itemsView.rowCount;

            // If there is a set of items selected
            if (this.selectedItemsList.length > 1){
                try{
                    // Try to merge them
                    if (this.mergeSelectedItems(DuplicatesPane, this.selectedItemsList, true))
                    {
                        this.currentRowCount = DuplicatesPane.itemsView.rowCount;
                        this.updateProgressWindow();
                        this.errorCount = 0;                    
                    }
                    else{
                        Zotero.logError("DuplicatesMerger: unable to merge items");
                        this.errorCount = this.errorCount + 1;
                    }
                }catch(e){
                    Zotero.logError("DuplicatesMerger is having some issues");
                    Zotero.logError("DuplicatesMerger: Error while merging of items");
                    
                    this.selectedItemsList.length = 0;
                    this.noSkippedItems = 0;
                    this.errorCount = this.errorCount + 1;

                    await new Promise(r => setTimeout(r, 2000));
                    if (this.errorCount > 5){
                        // An error occured! Stop running and close notification window
                        this.isRunning = false;
                        this.closeProgressWindow(0, this.getFormattedString("general.errorHasOccurredHeader"),this.getFormattedString("general.errorHasOccurredMsg"));
                        await new Promise(r => setTimeout(r, 2000));
                        break;
                    }
                }
            }
            
            // Wait for a bit and then select the next set of items
            await new Promise(r => setTimeout(r, delayBetweenCalls));
            this.selectNextDuplicatedItems(DuplicatesPane);
        }        
        catch (e) {
            Zotero.logError("DuplicatesMerger is having some issues");
            Zotero.logError("DuplicatesMerger: Error while retrieving items to merge");
           
            this.selectedItemsList.length = 0;
            this.noSkippedItems = 0;
            this.errorCount = this.errorCount + 1;

            await new Promise(r => setTimeout(r, 2000));
            if (this.errorCount > 5){                     
                // An error occured! Stop running and close notification window
                this.isRunning = false;
                this.closeProgressWindow(0, this.getFormattedString("general.errorHasOccurredHeader"),this.getFormattedString("general.errorHasOccurredMsg"));
                await new Promise(r => setTimeout(r, 2000));
                break;
            }
        }
    }

    await new Promise(r => setTimeout(r, 2 * delayBetweenCalls));

    var processed = this.initialNoItems - this.currentRowCount + this.noMismatchedItems
    if (this.currentRowCount == Zotero.DuplicatesMerger.noMismatchedItems){
        this.closeProgressWindow(1, this.getFormattedString("general.progressCompletedHeader"), this.getFormattedString("general.progressCompleteMsg", [processed]));
    }
    else{
        this.closeProgressWindow(0, this.getFormattedString("general.progressInterrupterHeader"), this.getFormattedString("general.progressInterrupterMsg", [processed]));
    }

    this.isRunning = false;
};

if (typeof window !== 'undefined') {
    window.addEventListener('load', function(e) {
        Zotero.DuplicatesMerger.init();
    }, false);
}
