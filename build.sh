#!/bin/sh
echo Enter version number:
read version
rm zotero-duplicatesmerger-${version}.xpi
zip -r zotero-duplicatesmerger-${version}.xpi chrome/* defaults/* chrome.manifest install.rdf options.xul
