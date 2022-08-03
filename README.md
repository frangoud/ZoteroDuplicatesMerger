# Zotero Duplicates Merger

This is an add-on for Zotero that makes merging duplicated items easier. It offers two different modes:
  - Smart merge items: can be used from any collection view pane by selecting two or more items to merge or from the built-in 'Duplicate Items' pane itself for already selected items
  - Bulk merge items: can be used only from the 'Duplicate Items' Pane, and it will automatically start from the top of the list, process all displayed items, and merge the duplicated items without any additional prompt (CAUTION: use this option only if you know that all shown duplicated items are indeed duplicates). The process calls the merging methods that are used by Zotero. While in bulk merge mode, you can change the active pane to stop the process

Please report any bugs, questions, or feature requests on the addons' GitHub page.

Code for this extension is based in part [Zotero DOI Manager](https://github.com/bwiernik/zotero-shortdoi) by Brenton M. Wiernik and [Zotfile](https://github.com/jlegewie/zotfile). The idea and functionality of the add-on was based on existing threads in Zotero forums.

### Installation Instructions

  - Download the latest extension file (.xpi) from releases
  - Open Zotero and navigate to the sub-menu option 'Tools -> Add-ons' from the top toolbar to open the Add-ons Manager
  - Next, you can do one of the two:
    - drag and drop the .xpi file to the manager window that opened,
    - click the small drop-down wheel in the top right corner of the manager window, click 'Install Add-on From File', and select the downloaded .xpi file
  - Restart Zotero

### Plugin Functions

  - Smart merge selected items
  - Bulk Merge duplicate items automatically

  Both functions, run from the context menu, by right clicking on any selected items. The smart merge functionality can also run by using a button that is located at the top right corner of the toolbar (next to the refresh button)
  
### Available Options
  - Select which of the duplicate copies will be the master one (newest or oldest): by selecting older or newest the addon will select as the master entry (the one that the merging will be based on) the appropriate one using the time they were last modified within Zotero
  - Select how to handle type conflicts (skip items, force type of master): this option determines what will happen if two items that are duplicates have different item types (e.g., journal article and conference paper). Skip will ignore any duplicate items leaving them as they are. 'Force type of master' will change any items that are different from the type of the master, to that one
  - Skip preview of merge results (note: this only works for smart merge, and not for bulk merge): the default functionality of smart merge function will apply any changes to the duplicate items, but will not perform the actual merging (this is up to the user). By selecting this option this intermediate 'review' step will be ignored, and the duplicate items will be merged

### Know Issues
  - There currently is a memory issue when using the bulk merge method. (I believe the bug happens because of the reprocessing of the items in the 'Duplicate Items' Pane). The bug will cause the plugin (or even Zotero to crush or freeze). This is more evident the greater the number of duplicated items is. In my testing this happened once there were more than ~5K entries in the list.
  - Sometimes when clicking the bulk merge button the progress window will appear but then nothing happens. Usually, this happens when you just open Zotero and is already in the 'Duplicate Items' pane and you try to bulk merge. If this happens try switching panes (e.g., go to 'My Publications' or to a collection) and then back to the 'Duplicate Items' pane, or restart Zotero and it usually fixes the problem. Otherwise, you can also try manually merging the top items on the list and try again

### License

Copyright (C) 2022 Fotos Frangoudes

Distributed under the Mozilla Public License (MPL) Version 2.0.
