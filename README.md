# Zotero Duplicates Merger

This is an add-on for Zotero that makes merging duplicated items easier. It offers two different modes:
  - Smart merge items: can be used in the collection view pane by selecting two or more items to merge
  - Bulk merge items: can be used only from the Duplicate Items Pane, and it will automatically go from the top of the list all the way to the end and merge the duplicated items without any additional prompt (CAUTION: use this option only if you know that all shown duplicated items are indeed duplicated)

Please report any bugs, questions, or feature requests on the projects' GitHub page or the Zotero forums.

Code for this extension is based in part [Zotero DOI Manager](https://github.com/bwiernik/zotero-shortdoi) by Brenton M. Wiernik and [Zotfile](https://github.com/jlegewie/zotfile). The idea and functionality of the add-on is based on existing threads in Zotero forums

### Installation Instructions

  - Download the latest extension file (.xpi) from releases
  - Open Zotero and navigate to the sub-menu option "Tools -> Add-ons" from the top toolbar to open the Add-ons Manager
  - Next, you can do one of the two:
    > drag and drop the .xpi file to the manager window that opened
    > click the small drop-down wheel in the top right corner of the manager window, click "Install Add-on From File”, and select the downloaded .xpi file
  - Restart Zotero

### Plugin Functions

  - Smart merge selected items  
  - Bulk Merge duplicate items automatically

### Available Options
  - Select which of the duplicate copies will be the master one (newest or oldest)  
  - Select how to handle type conflicts (skip items, force type of master)

### Know Issues
  - There currently is a memory leak bug with the bulk merge method. (I believe the bug happens because of the sorting of the duplicated items pane). The bug will cause the plugin (or even Zotero to crush). This is more evident the greater the number of duplicated items. In my testing this happened once there were more than ~5K entries in the list.

### License

Copyright (C) 2021 Fotos Frangoudes

Distributed under the Mozilla Public License (MPL) Version 2.0.
