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
    this.nextPossibleDuplicateItem = 0;
    this.isRunning = false;
    this.counter = 0;
    this.totalItems = 1;

    //this.stringsBundle = document.getElementById('duplicatesmerger-bundle');
    this.stringsBundle = Components.classes['@mozilla.org/intl/stringbundle;1']
    .getService(Components.interfaces.nsIStringBundleService)
    .createBundle('chrome://zoteroduplicatesmerger/locale/duplicatesmerger.properties');
/*
    // Register the callback in Zotero as an item observer
    var notifierID = Zotero.Notifier.registerObserver(
        Zotero.DuplicatesMerger.notifierCallback, ['item']);

    // Unregister callback when the window closes (important to avoid a memory leak)
    window.addEventListener('unload', function(e) {
        Zotero.Notifier.unregisterObserver(notifierID);
    }, false);
*/
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
        tools_oldest.setAttribute("checked", Boolean(pref === "oldest"));
        tools_newest.setAttribute("checked", Boolean(pref === "newest"));
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

Zotero.DuplicatesMerger.mergeSelectedItems = async function(DupPane, items){
    // try {
        DupPane.mergeSelectedItems();
        
        var masterSelectionPreference = getPref("master");

        items.sort(function (a, b) {
            return a.dateAdded > b.dateAdded ? 1 : a.dateAdded == b.dateAdded ? 0 : -1;
        });
        
        var masterIndex = 0;
        if (masterSelectionPreference == "newest"){
            masterIndex = items.length - 1;
        }
        if (masterIndex > 0){
            setTimeout(function () {
                var dateList = document.getElementById('zotero-duplicates-merge-original-date');
                dateList.selectedIndex = masterIndex;
            }, 0);
            Zotero_Duplicates_Pane.setMaster(masterIndex);  
        }

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
                Zotero.DuplicatesMerger.nextPossibleDuplicateItem += items.length;
                return false;
            }
            else if (typemismatchPreference == "master"){
                for (let item of items) {
                    if (masterTypeId != item.itemTypeID){
                        item.setField("itemTypeID",masterTypeId);
                        await item.saveTx();
                    }
                }
            }
        }

        //Merge
        //Zotero.DuplicatesMerger.nextPossibleDuplicateItem += items.length;
        Zotero_Duplicates_Pane.merge();
        return true;
    // } catch (e){
    //     throw new Error(`Failed merging items with error: ${e}`);
    // }
};

/**
 * Selects the next available set of duplicated items
 *
 * @param {ZoteroPane} pane
 * @return {Integer}  count of selected items
 * @return {Interger[]}
 */
Zotero.DuplicatesMerger.selectNextDuplicatedItems = function (pane){
    if (pane.itemsView.rowCount > 0){
        var itemID = pane.itemsView.getRow(Zotero.DuplicatesMerger.nextPossibleDuplicateItem).ref.id;
        var setItemIDs = pane.getCollectionTreeRow().ref.getSetItemsByItemID(itemID);
        if (setItemIDs.length <= 1)
            return {
                count: 0,
                items: []
            };
        pane.itemsView.selectItems(setItemIDs);

        return{
            count: setItemIDs.length,
            items: pane.itemsView.getSelectedItems()
        };
    }
    return {
        count: 0,
        items: []
    };
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
    var icon = "chrome://zotero/skin/tick.png";
    this.progressWindow = new Zotero.ProgressWindow({closeOnClick:false});
    this.progressWindow.changeHeadline(this.getFormattedString("general.progressHeaderInitial"), iconHeadline);
    this.progressWindow.progress = new this.progressWindow.ItemProgress(icon);
    this.progressWindow.progress.setProgress(100);
    this.progressWindow.progress.setText(this.getFormattedString("general.progressMsgInitial", [this.totalItems]));
    this.progressWindow.show();
    
    // Zotero.DuplicatesMerger.progressWindow.startCloseTimer(4000);
    // Zotero.DuplicatesMerger.progressWindow = new Zotero.ProgressWindow({closeOnClick: false});
    // Zotero.DuplicatesMerger.progressWindow.changeHeadline("Merging duplicates", icon);
    // Zotero.DuplicatesMerger.progressWindow.progress = new Zotero.DuplicatesMerger.progressWindow.ItemProgress(icon, "Merging duplicates.");
};

/**
 * Update the progress window based on the number of items processed
 */
Zotero.DuplicatesMerger.updateProgressWindow = function () {
    var percent = Math.round((this.counter/this.totalItems)*100);
    this.progressWindow.progress.setProgress(percent);
    this.progressWindow.progress.setText(this.getFormattedString("general.itemsProcessed", [this.counter, this.totalItems]));
    this.progressWindow.show();
};

Zotero.DuplicatesMerger.closeProgressWindow = function (errorNo, header, msg) {
    var iconHeadline = 'chrome://zotero/skin/treesource-duplicates' + (Zotero.hiDPI ? "@2x" : "") + '.png';
    if (errorNo == 0){
        this.progressWindow.changeHeadline(header, iconHeadline);
        this.progressWindow.progress.setProgress(100);
        this.progressWindow.progress.setText(msg);
        this.progressWindow.show();
        this.progressWindow.startCloseTimer(2000);
    }
    else{
        this.progressWindow.changeHeadline(header, iconHeadline);
        this.progressWindow.addDescription(msg);
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
    // Notify start of the duplicate merger
    this.isRunning = true;    

    // Initialize time out counter to pace the merging
    var idleCount = 0;
    var processedDelay = 0;

    var delayBetweenCalls = getPref("delay");

    // Keep reference of the duplicates pane
    var DuplicatesPane = Zotero.getActiveZoteroPane();

    // Intialize progress / acitve item counters
    this.counter = 0;
    this.totalItems = DuplicatesPane.itemsView.rowCount;
    this.nextPossibleDuplicateItem = 0;

    // Create Progress Windows
    this.createProgressWindow();

    // Retrive the first items from the list
    var selectedItems = this.selectNextDuplicatedItems(DuplicatesPane);
    // Go while the duplicates pane is still the selected pane,
    // there are still items to be processed, and plugin hasn't timed out
    while (DuplicatesPane.getCollectionTreeRow().isDuplicates() && DuplicatesPane.itemsView.rowCount > (Zotero.DuplicatesMerger.nextPossibleDuplicateItem+1) && idleCount < 10) {
        // If there is a set of items selected
        if (selectedItems.count > 1) {
            try{
                // Try to merge them        
                this.counter += selectedItems.count;                
                this.mergeSelectedItems(DuplicatesPane, selectedItems.items);
                
                // Wait for a bit and then select the next set of items
                await new Promise(r => setTimeout(r, delayBetweenCalls));
                this.updateProgressWindow();
                selectedItems = this.selectNextDuplicatedItems(DuplicatesPane);

            }catch(e){
                // An error occured! Stop running and close notification window
                this.isRunning = false;

                this.closeProgressWindow(1, this.getFormattedString("general.errorHasOccurredHeader"),this.getFormattedString("general.errorHasOccurredMsg"));

                throw new Error('Stopping execution of duplicates merging');
            }
            
            // A set of items has been processed this cycle
            // => reset idle counters
            idleCount = 0;
            processedDelay = 0;
        }
        else {
            if (processedDelay > 1){
                idleCount = idleCount + 1;
                selectedItems = this.selectNextDuplicatedItems(DuplicatesPane);
            }
        }

        await new Promise(r => setTimeout(r, delayBetweenCalls));
        processedDelay += delayBetweenCalls;
    }

    await new Promise(r => setTimeout(r, 2 * delayBetweenCalls));
    if (DuplicatesPane.itemsView.rowCount <= (this.nextPossibleDuplicateItem+1)){
        this.closeProgressWindow(0, this.getFormattedString("general.progressCompleteHeader"),this.getFormattedString("general.progressCompleteMsg", [this.counter]));
    }
    else{
        this.closeProgressWindow(0, this.getFormattedString("general.progressInterrupterHeader"),this.getFormattedString("general.progressInterrupterMsg", [this.counter]));
    }
    this.isRunning = false;
};

if (typeof window !== 'undefined') {
    window.addEventListener('load', function(e) {
        Zotero.DuplicatesMerger.init();
    }, false);
}
