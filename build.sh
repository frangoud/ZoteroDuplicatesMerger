#!/bin/sh
echo Enter version number:
read version
rm ZoteroDuplicatesMerger-v${version}.xpi
zip -r ZoteroDuplicatesMerger-${version}.xpi chrome/* defaults/* chrome.manifest install.rdf LICENSE README.md update.rdf
