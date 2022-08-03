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
    
    this.noMismatchedItemsSkipped = 0;
    this.noSkippedItems = 0;
    
    this.lastProcessedItemId = 0;
    this.currentRowCount = 0;
    
    this.isRunning = false;
    this.elapsedTimeSinceLastAction = 0;
    this.initialNoItems = 1;

    this.selectedItemsList = [];
    this.selectedItemsIds = [];
    this.mismatchedIds = [];

    this.current_state = "idle";

    this.stringsBundle = Components.classes['@mozilla.org/intl/stringbundle;1']
    .getService(Components.interfaces.nsIStringBundleService)
    .createBundle('chrome://zoteroduplicatesmerger/locale/duplicatesmerger.properties');

    // Switch to duplicates pane if selected
    //this.RestartDuplicatesMerge();
};

getCurrentTime = function(){
    return Zotero.Date.dateToSQL(new Date(Date.now()), true);
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
    win.ZoteroPane.document.getElementById('duplicatesmerger-itemmenu-single').setAttribute('hidden', false);
}.bind(Zotero.DuplicatesMerger);

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
    var processed = this.initialNoItems - this.currentRowCount + this.noMismatchedItemsSkipped;
    var percent = Math.round((processed/this.initialNoItems)*100);
    this.progressWindow.progress.setProgress(percent);
    this.progressWindow.progress.setText(this.getFormattedString("general.itemsProcessed", [processed, this.initialNoItems, this.currentRowCount - this.noMismatchedItemsSkipped]));
    this.progressWindow.show();
};

Zotero.DuplicatesMerger.closeProgressWindow = function (errorNo, header, msg) {
    var iconHeadline = 'chrome://zotero/skin/treesource-duplicates' + (Zotero.hiDPI ? "@2x" : "") + '.png';
    if (errorNo == 0) {
        this.progressWindow.changeHeadline(header, iconHeadline);
        this.progressWindow.progress = new this.progressWindow.ItemProgress("chrome://zotero/skin/cross.png");
        this.progressWindow.progress.setProgress(100);
        this.progressWindow.progress.setText(msg);
        this.progressWindow.show();
        this.progressWindow.startCloseTimer(5000);
    }
    else {
        this.progressWindow.changeHeadline(header, iconHeadline);
        this.progressWindow.addDescription(msg);
        this.progressWindow.progress = new this.progressWindow.ItemProgress("chrome://zotero/skin/tick.png");
        this.progressWindow.show();
        this.progressWindow.startCloseTimer(5000);
    }
};

/**
 * Single item merge
 */
Zotero.DuplicatesMerger.smartMerge = function() {
    this.selectedItemsList = Zotero.getActiveZoteroPane().itemsView.getSelectedItems();
    
    var skippreview = getPref("skippreview");
    this.mergeSelectedItems(skippreview );
};

function getCreatorName(creatorEntry){
    if (creatorEntry.name != null)
        return creatorEntry.name;
    return creatorEntry.lastName + " " + creatorEntry.firstName;
}

/**
 * Bulk merge
 */
Zotero.DuplicatesMerger.mergeSelectedItems = async function(performMerge){
    DupPane = Zotero.getActiveZoteroPane();

    this.current_state = "merge_items";

    await DupPane.mergeSelectedItems();
    await Zotero.Promise.delay(1);

    items = DupPane.getSelectedItems();
    
    // Find the master item
    var masterSelectionPreference = getPref("master");
    
    items.sort(function (a, b) {
        return a.dateAdded > b.dateAdded ? 1 : a.dateAdded == b.dateAdded ? 0 : -1;
    });

    if (this.showDebug)
        Zotero.log("(" + getCurrentTime() + ") DuplicatesMerger: attempt items merge");

    var masterIndex = 0;
    if (masterSelectionPreference == "newest"){
        masterIndex = items.length - 1;
    }
    // Select as master item the one that has the longest first name author
    else if (masterSelectionPreference == "creator"){
        // Retrieve the possible alternatives for each property
        var item = items[0];
        var _otherItems = items.concat();
        var alternatives = item.multiDiff(_otherItems, this._ignoreFields);

        // If there are alternatives names for the creators
        if (alternatives.creators != null){
            // find the length of the first creator for the first entry
            var longestCreatorsNameLength = 0;
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
    this.current_state = "merge_items:select_master";
    if (masterIndex > 0){
        var dateList = document.getElementById('zotero-duplicates-merge-original-date');
        dateList.selectedIndex = masterIndex;

        Zotero_Duplicates_Pane.setMaster(masterIndex);
    }

    // Handle type mismatching between items
    var masterTypeId = items[masterIndex].itemTypeID;
    for (let item of items) {
        // if a type mismatch was found then handle it
        if (masterTypeId != item.itemTypeID){            
            var typemismatchPreference = getPref("typemismatch");
            if (typemismatchPreference == "skip"){                
                this.current_state = "idle";
                return false;
            }
            else if (typemismatchPreference == "master"){
                for (let item of items) {
                    if (masterTypeId != item.itemTypeID){
                        item.setType(masterTypeId);
                    }
                }
                await Zotero.Promise.delay(200);
            }
            break;
        }
    }

    /// Merge Items
    this.current_state = "merge_items:handle_alternatives";
    var masterItem = items[masterIndex];
    var _otherItems = items.concat();

    // Add master item's values to the beginning of each set of
    // alternative values so that they're still available if the item box
    // modifies the item
    var alternatives = masterItem.multiDiff(_otherItems, this._ignoreFields);
    if (alternatives) {
        let itemValues = masterItem.toJSON();
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
    
    this.current_state = "merge_items:merging";
    if (performMerge == true){
        await Zotero_Duplicates_Pane.merge();
    }
    this.current_state = "idle";

    return true;
};

/**
 * Selects the next available set of duplicated items
 *
 * @param {ZoteroPane} pane
 * @return {Integer}  count of selected items
 * @return {Interger[]}
 */
 Zotero.DuplicatesMerger.getNextDuplicatedItems = async function (pane){
    if (typeof pane == 'undefined' || this.selectedItemsList.length > 0) 
        return false;
    
    this.current_state = "get_next_items";
    var newSelectedItems = pane.getSelectedItems(); 
    var totalWaitTime = 0;
    while(this.isRunning && totalWaitTime < 30000){
        var newSelectedItemsIds = [];
        // try to get the next items that are selected for 30s at most
        while(this.isRunning && newSelectedItems.length <= 1 && totalWaitTime < 30000){
            this.current_state = "get_next_items:waiting_new_items";
            
            await Zotero.Promise.delay(100);
            newSelectedItems = pane.getSelectedItems();
            totalWaitTime = totalWaitTime + 100;
        }
        
        // no new items were selected in time
        if (newSelectedItems.length <= 1){
            if (this.showDebug)
                Zotero.log("(" + getCurrentTime() + ") DuplicatesMerger: get next asking for new selection due to timeout ");
            // attempt to manually select the next items;
            let selectionResult = await this.selectNextDuplicatedItems(pane);
            this.current_state = "idle";
            return selectionResult;
        }
        else{
            for (var item in newSelectedItems)
                newSelectedItemsIds.push(newSelectedItems[item].id);
        }

        // if any items were selected,
        // check to see if they were type mismatches found earlier
        var foundMismatched = false;
        this.current_state = "get_next_items:checking_mismatches";
        for(var i = 0, count = this.mismatchedIds.length; i < count; i++){
            for (var itemId of newSelectedItemsIds){
                if (itemId !== this.mismatchedIds[i]) continue;
                foundMismatched = true;
            }
        }
        
        if (foundMismatched){
            if (this.showDebug)
                Zotero.log("(" + getCurrentTime() + ") DuplicatesMerger: get next asking for new selection due to mismatch");

            // attempt to manually select the next items;
            let selectionResult = await this.selectNextDuplicatedItems(pane);
            this.current_state = "idle";
            return selectionResult;            
        }
        else{
            this.selectedItemsIds = newSelectedItemsIds;
            
            this.lastProcessedItemId = this.selectedItemsIds[0];
            this.selectedItemsList = newSelectedItems;
            if (this.noSkippedItems > 0)
                this.noSkippedItems = 0;
            this.current_state = "idle";
            return true;
        }
    }
    
    if (this.showDebug)
        Zotero.log("(" + getCurrentTime() + ") DuplicatesMerger: getting next exited without a selection");
    this.current_state = "idle";
    return false;
};

/**
 * Selects the next available set of duplicated items
 *
 * @param {ZoteroPane} pane
 * @return {Integer}  count of selected items
 * @return {Interger[]}
 */
Zotero.DuplicatesMerger.selectNextDuplicatedItems = async function (pane){
    if (typeof pane == 'undefined' || this.selectedItemsList.length > 0){
        if (this.showDebug)
            Zotero.log("(" + getCurrentTime() + ") DuplicatesMerger: select next exited before starting");
        return false;
    }
    this.current_state = "select_next_items";

    this.noSkippedItems = 0;
    var nextItemIdx = this.noMismatchedItemsSkipped + this.noSkippedItems;
    while (this.isRunning && pane.itemsView.rowCount > nextItemIdx){
        this.current_state = "select_next_items:looking_for_items";
        // find the id of the next available item in the list
        var itemID = pane.itemsView.getRow(nextItemIdx).ref.id;
        var foundMismatched = false;
        for(var i = 0, count = this.mismatchedIds.length; i < count ; i++){
            if (itemID !== this.mismatchedIds[i]) continue;

            this.mismatchedIds.splice(i, 1);
            this.noMismatchedItemsSkipped = this.noMismatchedItemsSkipped + 1;
            nextItemIdx += 1;
            
            break;
        }
        if (foundMismatched) continue;

        this.current_state = "select_next_items:validating_new_items";

        // get the items that have the same ID as the selected one
        var newSelectedItemsIds = pane.getCollectionTreeRow().ref.getSetItemsByItemID(itemID);
        
        // if item not found, then it was deleted
        if (newSelectedItemsIds.length == 0){
            if (this.noSkippedItems > 0)
                // reset skipped items and start over
                this.noSkippedItems = 0;
                
            await Zotero.Promise.delay(500);
        }
        // if no more than one item exists with the given id (i.e. selected item has no duplicates)
        else if (newSelectedItemsIds.length == 1){
            // add to the current offset so that the non-duplicated item can be skipped next time
            this.noSkippedItems = this.noSkippedItems + 1;
            
            await Zotero.Promise.delay(500);
        }
        else{ // if the selected item has duplicates            
            // mark the id of the item
            this.lastProcessedItemId = itemID;

            // select all items with that id
            this.selectedItemsIds = newSelectedItemsIds;
            pane.itemsView.selectItems(this.selectedItemsIds);
            
            // and update the references to the selected items
            this.selectedItemsList = pane.itemsView.getSelectedItems();

            if (this.noSkippedItems > 0)
                this.noSkippedItems = 0;
            
            this.current_state = "idle";
            return true;            
        }
        
        nextItemIdx = this.noMismatchedItemsSkipped + this.noSkippedItems;
    }
    
    this.selectedItemsList.length = 0;
    this.noSkippedItems = 0;
    
    if (this.showDebug)
        Zotero.log("(" + getCurrentTime() + ") DuplicatesMerger: select next exited without a selection");

    this.current_state = "idle";
    return false;
};

/**
 * Check whether the user is the duplicates pane
 */
Zotero.DuplicatesMerger.checkFocusAsync = async function (){
    while(this.isRunning){
        await Zotero.Promise.delay(1000);
        this.elapsedTimeSinceLastAction += 1000;
        
        this.isRunning = this.isRunning && Zotero.getActiveZoteroPane().getCollectionTreeRow().isDuplicates() && this.elapsedTimeSinceLastAction < 120000;
    }
    if (this.elapsedTimeSinceLastAction >= 120000)
        Zotero.logError("(" + getCurrentTime() + ") DuplicatesMerger timed out"); 

    if (this.showDebug)
        Zotero.log("(" + getCurrentTime() + ") DuplicatesMerger: check focus exited");
};

Zotero.DuplicatesMerger.RestartDuplicatesMerge = async function () {
    var win = Services.wm.getMostRecentWindow('navigator:browser');
    
    var pane = Zotero.getActiveZoteroPane();
    let libraryId = 1;// pane.getSelectedLibraryID();
    win.ZoteroPane.setVirtual(libraryId, 'duplicates', true, true);
    
    pane = Zotero.getActiveZoteroPane();
    var elapsedTime = 0;
    while (pane.itemsView.rowCount == 0 && elapsedTime < 60000)
    {
        await Zotero.Promise.delay(2000);        
        elapsedTime += 2000;
    }
    
    if (elapsedTime < 60000){
        this.mergeDuplicates();    
        toJavaScriptConsole();
    }
};

/**
 * Main plugin function: Merge duplicate items
 */
Zotero.DuplicatesMerger.mergeDuplicates = async function () {
    // Prevent the merger to run again, if it's already running
    if(this.isRunning)
    {
        Zotero.log("(" + getCurrentTime() + ") DuplicatesMerger: Merger is already running");
        return;
    }

    // Keep reference of the duplicates pane
    var DuplicatesPane = Zotero.getActiveZoteroPane();
    if (!DuplicatesPane.getCollectionTreeRow().isDuplicates()){
        Zotero.logError("(" + getCurrentTime() + ") DuplicatesMerger: Pane is not duplicates");
        return;
    }
    this.current_state = "merge_duplicates";

    // Notify start of the duplicate merger
    this.isRunning = true;
    
    var delayBetweenCalls = getPref("delay");
    this.showDebug = getPref("showdebug");

    // Intialize progress / acitve item counters
    
    this.noMismatchedItemsSkipped = 0;
    this.noSkippedItems = 0;
    
    this.lastProcessedItemId = 0;
    
    this.selectedItemsList = [];
    this.selectedItemsIds = [];
    this.mismatchedIds = [];

    this.initialNoItems = DuplicatesPane.itemsView.rowCount;
    this.currentRowCount = DuplicatesPane.itemsView.rowCount;

    await DuplicatesPane.getCollectionTreeRow().ref.getSearchObject();

    // Create Progress Windows
    this.createProgressWindow();

    // Retrieve the first items from the list
    await this.selectNextDuplicatedItems(DuplicatesPane);
    
    // var errorCount = 0;
    this.errorCount = 0;
    this.elapsedTimeSinceLastAction = 0;
    
    this.checkFocusAsync();

    // Go while the duplicates pane is still the selected pane,
    // there are still items to be processed, and plugin hasn't timed out
    while (this.isRunning && this.currentRowCount > (this.noMismatchedItemsSkipped+1) && this.errorCount <= 5) {
        this.current_state = "merge_duplicates:loop";
        try{
            // If there is a set of items selected
            if (this.selectedItemsList.length > 1){
                try{
                    // Try to merge them
                    this.current_state = "merge_duplicates:attempt_merge";
                    let mergeResult = await this.mergeSelectedItems(true);
                    if (mergeResult == true)
                    {
                        this.current_state = "merge_duplicates:successful_merge";
                        
                        var newSelectedItems = DuplicatesPane.getSelectedItems();
                        var newSelectedItemId = newSelectedItems[0].id;
                        
                        
                        if (this.showDebug)
                        Zotero.log("(" + getCurrentTime() + ") DuplicatesMerger: successfully merged item " + this.lastProcessedItemId);
                        
                        // merge succesfully completed
                        var currentActionElapsedTime = 0;
                        while (this.isRunning && newSelectedItemId == this.lastProcessedItemId && currentActionElapsedTime < 20000){
                            this.current_state = "merge_duplicates:waiting_item_removal";
                            await Zotero.Promise.delay(500);
                            currentActionElapsedTime += 500;
                            newSelectedItems = DuplicatesPane.getSelectedItems();
                            newSelectedItemId = newSelectedItems[0].id;
						}
                            
                        
                        if (this.showDebug)
                            Zotero.log("(" + getCurrentTime() + ") DuplicatesMerger: finished waiting for new id (" + this.lastProcessedItemId + " - " + newSelectedItemId + "), wait time: " + currentActionElapsedTime);

                        if (currentActionElapsedTime < 20000)
                            this.elapsedTimeSinceLastAction = 0;

                        this.updateProgressWindow();
                    }
                    else{
                        this.current_state = "merge_duplicates:found_mismatch";
                        
                        if (this.showDebug)
                            Zotero.log("(" + getCurrentTime() + ") DuplicatesMerger: found type mismatch - skipping");

                        for (let newId of this.selectedItemsIds){
                            this.mismatchedIds.splice(0, 0, newId);
                        }
                        this.elapsedTimeSinceLastAction = 0;
                        this.updateProgressWindow();
                    }

                    this.errorCount = 0;
                }catch(e){                    
                    this.current_state = "merge_duplicates:merging_error";
                    if (this.showDebug){
                        Zotero.log("(" + getCurrentTime() + ") DuplicatesMerger: DuplicatesMerger is having some issues");
                        Zotero.log("(" + getCurrentTime() + ") DuplicatesMerger: Error while merging of items");
                    }
                    this.errorCount = this.errorCount + 1;

                    await Zotero.Promise.delay(2000);
                    
                    if (this.errorCount > 5){
                        // An error occured! Stop running and close notification window
                        this.isRunning = false;
                        Zotero.logError("(" + getCurrentTime() + ") DuplicatesMerger is stopping");
                        this.closeProgressWindow(0, this.getFormattedString("general.errorHasOccurredHeader"),this.getFormattedString("general.errorHasOccurredMsg"));

                        await Zotero.Promise.delay(2000);
                        
                        break;
                    }
                }
                finally{
                    this.selectedItemsList.length = 0;
                    this.noSkippedItems = 0;
                }
            }
            
            // Wait for a bit and then select the next set of items
            await Zotero.Promise.delay(delayBetweenCalls);

            await this.getNextDuplicatedItems(DuplicatesPane);
        }
        catch (e) {
            this.current_state = "merge_duplicates:identification_error";
            if (this.showDebug){
                Zotero.log("(" + getCurrentTime() + ") DuplicatesMerger: DuplicatesMerger is having some issues");
                Zotero.log("(" + getCurrentTime() + ") DuplicatesMerger: Error while retrieving items to merge");
            }

            this.selectedItemsList.length = 0;
            this.noSkippedItems = 0;
            this.errorCount = this.errorCount + 1;

            if (this.errorCount > 5){           
				Zotero.logError("(" + getCurrentTime() + ") DuplicatesMerger is stopping due to errors merging");          
                // An error occured! Stop running and close notification window
                this.isRunning = false;
                this.closeProgressWindow(0, this.getFormattedString("general.errorHasOccurredHeader"),this.getFormattedString("general.errorHasOccurredMsg"));
                await Zotero.Promise.delay(2000);
                break;
            }

            await Zotero.Promise.delay(2000);
        }
            
        this.currentRowCount = DuplicatesPane.itemsView.rowCount;
    }

    await Zotero.Promise.delay(delayBetweenCalls);
    
    var processed = this.initialNoItems - this.currentRowCount + this.noMismatchedItemsSkipped;
    if (this.currentRowCount == this.noMismatchedItemsSkipped){
        this.closeProgressWindow(1, this.getFormattedString("general.progressCompletedHeader"), this.getFormattedString("general.progressCompleteMsg", [processed]));
    }
    else{
        this.closeProgressWindow(0, this.getFormattedString("general.progressInterrupterHeader"), this.getFormattedString("general.progressInterrupterMsg", [processed]));
    }

    this.isRunning = false;

    if (this.showDebug)
        Zotero.log("(" + getCurrentTime() + ") DuplicatesMerger: exited with " + processed + " items processed!");

    this.noMismatchedItemsSkipped = 0;
    this.noSkippedItems = 0;
    
    this.lastProcessedItemId = 0;
    this.currentRowCount = 0;
    
    this.initialNoItems = 0;

    this.elapsedTimeSinceLastAction = 0;

    this.selectedItemsList = [];
    this.selectedItemsIds = [];
    this.mismatchedIds = [];

    this.current_state = "idle";
    
    await Zotero.Promise.delay(5000);

    if (this.isRunning)
        return;

    this.progressWindow = null;

    delete this.progressWindow;
};

if (typeof window !== 'undefined') {
    window.addEventListener('load', function(e) {
        Zotero.DuplicatesMerger.init();
    }, false);
}