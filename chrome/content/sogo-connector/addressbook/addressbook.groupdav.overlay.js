/* addressbook.groupdav.overlay.js - This file is part of "SOGo Connector", a Thunderbird extension.
 *
 * Copyright: Inverse inc., 2006-2010
 *    Author: Robert Bolduc, Wolfgang Sourdeau
 *     Email: support@inverse.ca
 *       URL: http://inverse.ca
 *
 * "SOGo Connector" is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 as published by
 * the Free Software Foundation;
 *
 * "SOGo Connector" is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License along with
 * "SOGo Connector"; if not, write to the Free Software Foundation, Inc., 51
 * Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

function jsInclude(files, target) {
    let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                           .getService(Components.interfaces.mozIJSSubScriptLoader);
    for (let i = 0; i < files.length; i++) {
        try {
            loader.loadSubScript(files[i], target);
        }
        catch(e) {
            dump("addressbook.groupdav.overlay.js: failed to include '" + files[i] +
                 "'\n" + e);
            if (e.fileName)
                dump ("\nFile: " + e.fileName
                      + "\nLine: " + e.lineNumber
                      + "\n\n Stack:\n\n" + e.stack);
        }
    }
}

jsInclude(["chrome://inverse-library/content/sogoWebDAV.js",
           "chrome://sogo-connector/content/addressbook/categories.js",
           "chrome://sogo-connector/content/addressbook/folder-handling.js",
           "chrome://sogo-connector/content/general/mozilla.utils.inverse.ca.js",
           "chrome://sogo-connector/content/general/sync.addressbook.groupdav.js",
           "chrome://sogo-connector/content/general/preference.service.addressbook.groupdav.js"]);

/*
 * This overlay adds GroupDAV functionalities to Addressbooks
 */

let gSelectedDir = "";
let gCurDirectory = null;
let gLDAPPrefsService = null;

/*****************************************************************************************
 *
 *  UI functions
 *
 *****************************************************************************************/
function AbNewGroupDavContacts(){
    window.openDialog("chrome://sogo-connector/content/addressbook/preferences.addressbook.groupdav.xul",
                      "", "chrome,modal=yes,resizable=no,centerscreen", null);
}

function openGroupdavPreferences(directory) {
    window.openDialog("chrome://sogo-connector/content/addressbook/preferences.addressbook.groupdav.xul",
                      "", "chrome,modal=yes,resizable=no,centerscreen",
                      { selectedDirectory: directory});
}

function SCOpenDeleteFailureDialog(directory) {
    window.openDialog("chrome://sogo-connector/content/addressbook/deletefailure-dialog.xul",
                      "", "chrome,modal=yes,resizable=no,centerscreen",
                      {directory: directory});
}

/********************************************************************************************
 *
 *  Override of the  UI functionalities
 *
 ********************************************************************************************/
function SCGoUpdateGlobalEditMenuItems() {
    try {
        gSelectedDir = GetSelectedDirectory();
        //  		dump("SCGoUpdateGlobalEditMenuItems\n  gSelectedDir" + gSelectedDir + "\n");
        goUpdateCommand("cmd_syncGroupdav");
        goUpdateCommand("cmd_syncAbortGroupdav");
        this.SCGoUpdateGlobalEditMenuItemsOld();
    }
    catch (e) {
        //		exceptionHandler(window,"Error",e);
    }
}

function SCCommandUpdate_AddressBook() {
    try {
        gSelectedDir = GetSelectedDirectory();
        //  		dump("SCCommandUpdate_AddressBook  gSelectedDir" + gSelectedDir + "\n");
        goUpdateCommand('cmd_syncGroupdav');
        goUpdateCommand("cmd_syncAbortGroupdav");
        this.SCCommandUpdate_AddressBookOld();
    }
    catch (e) {
        //		exceptionHandler(window,"Error",e);
    }
}

function SCGoUpdateSelectEditMenuItems() {
    try {
        gSelectedDir = GetSelectedDirectory();
        //  		dump("SCGoUpdateSelectEditMenuItems  gSelectedDir" + gSelectedDir + "\n");
        goUpdateCommand('cmd_syncGroupdav');
        goUpdateCommand("cmd_syncAbortGroupdav");
        this.SCGoUpdateSelectEditMenuItemsOld();
    }
    catch (e) {
        //		exceptionHandler(window,"Error",e);
    }
}

// Additionnal Controller object for Dir Pane
function dirPaneControllerOverlay() {
}

dirPaneControllerOverlay.prototype = {
    supportsCommand: function(command) {
        return (command == "cmd_syncGroupdav" || command == "cmd_syncAbortGroupdav");
    },

    isCommandEnabled: function(command) {
        let result = false;

        // 		dump("isCommandEnabled\n  command: " + command + "\n");

        if (gSelectedDir && gSelectedDir != "") {
            try {
                switch (command) {
                case "cmd_syncGroupdav":
                    result = isGroupdavDirectory(gSelectedDir);
                    break;
                case "cmd_syncAbortGroupdav":
                    result = isGroupdavDirectory(gSelectedDir);
                    break;
                    // case "cmd_newlist":
                    // case "cmd_newcard":
                    // 	let directory = SCGetDirectoryFromURI(gSelectedDir);
                    // 	result = (!directory.readOnly);
                    // 	break;
                }
            }
            catch (e) {
                exceptionHandler(window,"Exception",e);
            }
        }

        return result;
    },

    doCommand: function(command){
        dump("Unexpected doCommand: " + command + "\n");
        throw("Unexpected doCommand: " + command);
    },

    onEvent: function(event) {}
};

abDirTreeObserver.SCOnDrop = function(row, or) {
    let dragSession = dragService.getCurrentSession();
    if (dragSession) {
        /* Here, we don't seem to have the choice but to use the RDF
         interface to discover the target directory. */
        let sourceDirectory = gAbView.directory;
        let targetResource = gDirectoryTreeView.getDirectoryAtIndex(row);
        let targetURI = targetResource.URI;

        // dump("source dir: " + sourceDirectory + "\n");
        // dump("  source uri: " + sourceDirectory.URI + "\n");
        // dump("  target dir: " + targetURI + "\n");
        // dump("  targetReource: " + targetResource + "\n");
        let cardKeys = null;
        if (targetURI.indexOf(sourceDirectory.URI) != 0
            && isGroupdavDirectory(sourceDirectory.URI)) {
            if (dragSession.dragAction
                == Components.interfaces.nsIDragService.DRAGDROP_ACTION_MOVE) {
                cardKeys = this._getDroppedCardsKeysFromSession(dragSession, gAbView);
            }
            this._resetDroppedCardsVersionFromSession(dragSession, gAbView);
        }

        let proceed = true;
        try {
            this.SCOnDropOld(row, or);
        }
        catch(e) {
            proceed = false;
            dump("an exception occured: " + e + "\n");
        }

        if (targetResource.isMailList) {
            let uriParts = targetURI.split("/");
            let parentDirURI = uriParts[0] + "//" + uriParts[2];
            if (isGroupdavDirectory(parentDirURI)) {
                let attributes = new GroupDAVListAttributes(targetURI);
                attributes.version = "-1";
                SynchronizeGroupdavAddressbook(parentDirURI);
            }
        }
        else if (isGroupdavDirectory(targetURI)) {
            SynchronizeGroupdavAddressbook(targetURI);
        }

        if (cardKeys)
            dump("cardKeys: " + cardKeys.length + " to delete\n");
        else
            dump("cardKeys: nothing to delete\n");
        if (proceed && cardKeys) {
            let prefService = new GroupdavPreferenceService(sourceDirectory.dirPrefId);
            for (let i = 0; i < cardKeys.length; i++) {
                // 				dump("deleting " + cardKeys[i] + "\n");
                _deleteGroupDAVComponentWithKey(prefService, cardKeys[i]);
            }
        }
        dump("done drop delete\n");
    }
};

abDirTreeObserver._getDroppedCardsKeysFromSession = function(dragSession, abView) {
    let cards = [];

    let trans = Components.classes["@mozilla.org/widget/transferable;1"]
                          .createInstance(Components.interfaces.nsITransferable);
    trans.addDataFlavor("moz/abcard");

    for (let i = 0; i < dragSession.numDropItems; i++) {
        dragSession.getData(trans, i);
        let dataObj = {};
        let bestFlavor = {};
        let len = {};
        try	{
            trans.getAnyTransferData(bestFlavor, dataObj, len);
            dataObj = dataObj.value.QueryInterface(Components.interfaces.nsISupportsString);
            // 			dump("drop data = /" + dataObj.data + "/\n");
            let transData = dataObj.data.split("\n");
            let rows = transData[0].split(",");

            for (let j = 0; j < rows.length; j++) {
                let card = abView.getCardFromRow(rows[j]);
                if (card)
                    this._pushCardKey(card, cards);
            }

            // 			dump("cards: " + cards.length + "\n");
        }
        catch (ex) {
            dump("ex: " + ex + "\n");
        }
    }

    return cards;
};

abDirTreeObserver._resetDroppedCardsVersionFromSession = function(dragSession, abView) {
    let trans = Components.classes["@mozilla.org/widget/transferable;1"]
                          .createInstance(Components.interfaces.nsITransferable);
    trans.addDataFlavor("moz/abcard");

    for (let i = 0; i < dragSession.numDropItems; i++) {
        dragSession.getData(trans, i);
        let dataObj = {};
        let bestFlavor = {};
        let len = {};
        try {
            trans.getAnyTransferData(bestFlavor, dataObj, len);
            dataObj = dataObj.value.QueryInterface(Components.interfaces.nsISupportsString);
            // 			dump("drop data = /" + dataObj.data + "/\n");
            let transData = dataObj.data.split("\n");
            let rows = transData[0].split(",");

            for (let j = 0; j < rows.length; j++) {
                let card = abView.getCardFromRow(rows[j]);
                if (card) {
                    if (card.isMailList) {
                        let attributes = new GroupDAVListAttributes(card.mailListURI);
                        attributes.version = "-1";
                    }
                    else {
                        card.setProperty("groupDavVersion", "-1");
                        abView.directory.modifyCard(card);
                    }
                }
            }
        }
        catch (ex) {
            dump("ex: " + ex + "\n");
        }
    }
};

abDirTreeObserver._pushCardKey = function(card, cards) {
    let key = null;

    if (card.isMailList) {
        let attributes = new GroupDAVListAttributes(card.mailListURI);
        key = attributes.key;
    }
    else {
        key = card.getProperty("groupDavKey", null);
        // dump("ke2y: " + key + "\n");
    }

    if (key && key.length) {
        cards.push(key);
    }
};

function SCAbEditSelectedDirectory() {
    /* This method is no longer used for CardDAV addressbooks, since we now
     return a proper "propertiesChromeURI" attribute. */
    let abUri = GetSelectedDirectory();
    if (isGroupdavDirectory(abUri)) {
        let directory = SCGetDirectoryFromURI(abUri);
        openGroupdavPreferences(directory);
    }
    else {
        this.SCAbEditSelectedDirectoryOriginal();
    }
}

let deleteManager = {
    mCount: 0,
    mErrors: 0,
    mDirectory: null,
    begin: function(directory, count) {
        this.mDirectory = directory;
        this.mCount = count;
        this.mErrors = 0;
    },
    decrement: function(code) {
        this.mCount--;
        if (!((code > 199 && code < 400)
            || code == 404
              || code > 599))
            this.mErrors++;

        return (this.mCount == 0);
    },
    finish: function() {
        if (this.mErrors != 0)
            SCOpenDeleteFailureDialog(this.mDirectory);
        this.mDirectory = null;
    },
    onDAVQueryComplete: function(code, result, headers, data) {
        // 		dump("on davquerycompplete\n");
        if (data.deleteLocally
            && ((code > 199 && code < 400)
                || code == 404
                || code == 604)) {
            // 			dump("code: " + code + "\n");
            if (data.component.isMailList) {
                // 				dump("deleting list\n");
                let mailListURI = ((data.component
                                    instanceof Components.interfaces.nsIAbCard)
                                   ? data.component.mailListURI
                                   : data.component.URI);
                let attributes = new GroupDAVListAttributes(mailListURI);
                attributes.deleteRecord();
                /* we commit the preferences here because sometimes Thunderbird will
                 crash when deleting the real instance of the list. */
                let prefService = (Components.classes["@mozilla.org/preferences-service;1"]
                                             .getService(Components.interfaces.nsIPrefService));
                prefService.savePrefFile(null);

                let listDirectory = SCGetDirectoryFromURI(mailListURI);
                data.directory.deleteDirectory(listDirectory);
                // gAbView.deleteSelectedCards();
            }
            else {
                let cards = Components.classes["@mozilla.org/array;1"]
                                      .createInstance(Components.interfaces.nsIMutableArray);
                cards.appendElement(data.component, false);
                data.directory.deleteCards(cards);
            }
        }
        if (this.decrement(code))
            this.finish();
    }
};

function DeleteGroupDAVCards(directory, cards, deleteLocally) {
    dump("delete: " + cards.length + " cards\n");
    let mdbDirectory = SCGetDirectoryFromURI(directory);
    let prefService = new GroupdavPreferenceService(mdbDirectory.dirPrefId);

    deleteManager.begin(directory, cards.length);
    for (let i = 0; i < cards.length; i++) {
        let card = cards[i].QueryInterface(Components.interfaces.nsIAbCard);
        let key;
        if (card.isMailList) {
            let attributes = new GroupDAVListAttributes(card.mailListURI);
            key = attributes.key;
        }
        else {
            try {
                key = card.getProperty("groupDavKey", null);
            }
            catch(e) {
                key = null;
            }
        }

        dump("  card to delete: '" + card.displayName + "'\n");
        dump("    key: '" + key + "'\n");

        _deleteGroupDAVComponentWithKey(prefService, key, mdbDirectory, card, deleteLocally);
    }
}

function _deleteGroupDAVComponentWithKey(prefService, key,
                                         directory, component,
                                         deleteLocally) {
    dump("\n\nwe delete: " + key + " with deleteLocally="+deleteLocally+"\n\n\n");
    if (key && key.length) {
        let href = prefService.getURL() + key;
        let deleteOp = new sogoWebDAV(href, deleteManager,
                                      {directory: directory,
                                       component: component,
                                       deleteLocally: deleteLocally});
        deleteOp.delete();
        dump("webdav_delete on '" + href + "'\n");
        // force full sync on next sync by invalidating cTag.
        // This way, if server does not delete contact correctly (e.g. write permission denied)
        // the contact will reappear on next synchronization.
        prefService.setCTag("invalid");
    }
    else /* 604 = "not found locally" */
        deleteManager.onDAVQueryComplete(604, null, null,
                                         {directory: directory,
                                          deleteLocally: true,
                                          component: component});
}

function SCAbConfirmDelete(types) {
    let confirm = false;

    if (types != kNothingSelected) {
        let promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                      .getService(Components.interfaces.nsIPromptService);

        let confirmDeleteMessage;
        if (types == kListsAndCards)
            confirmDeleteMessage = gAddressBookBundle.getString("confirmDeleteListsAndContacts");
        else if (types == kMultipleListsOnly)
            confirmDeleteMessage = gAddressBookBundle.getString("confirmDeleteMailingLists");
        else if (types == kCardsOnly && gAbView && gAbView.selection) {
             if (gAbView.selection.count < 2)
                 confirmDeleteMessage = gAddressBookBundle.getString("confirmDeleteContact");
             else
                 confirmDeleteMessage = gAddressBookBundle.getString("confirmDeleteContacts");
        }
        else confirmDeleteMessage = gAddressBookBundle.getString("confirmDeleteMailingList");
        confirm = promptService.confirm(window, null, confirmDeleteMessage);
    }

    return confirm;
}

function SCAbDelete() {
    let deletePerformed = false;

    if (gSelectedDir) {
        if (isGroupdavDirectory(gSelectedDir)) {
            let types = GetSelectedCardTypes();
            if (types != kNothingSelected) {
                let confirm = SCAbConfirmDelete(types);
                if (!confirm)
                    return;
                else {
                    let cards = GetSelectedAbCards();
                    // let abView = GetAbView();
                    DeleteGroupDAVCards(gSelectedDir, cards, true);
                    deletePerformed = true;
                }
            }
        }
        else if (gSelectedDir.search("mab/MailList") > -1) {
            let parentURI = GetParentDirectoryFromMailingListURI(gSelectedDir);
            if (isGroupdavDirectory(parentURI)) {
                let list = SCGetDirectoryFromURI(gSelectedDir);
                let cards = GetSelectedAbCards();
                let xpcomArray = Components.classes["@mozilla.org/array;1"]
                                           .createInstance(Components.interfaces.nsIMutableArray);
                for (let i = 0; i < cards.length; i++) {
                    xpcomArray.appendElement(cards[i], false);
                }
                list.deleteCards(xpcomArray);
                let attributes = new GroupDAVListAttributes(gSelectedDir);
                attributes.version = "-1";
                SynchronizeGroupdavAddressbook(parentURI);
                deletePerformed = true;
            }
        }
    }

    if (!deletePerformed) {
        this.SCAbDeleteOriginal();
    }
}

/* AbDeleteDirectory done cleanly... */
function SCAbDeleteDirectory(aURI) {
    let result = false;

    dump("SCAbDeleteDirectory: aURI: " + aURI + "\n");
    dump("  backtrace:\n" + backtrace() + "\n\n");

    if (isGroupdavDirectory(aURI)) {
        // || isCardDavDirectory(selectedDir)) {
        // 			dump("pouet\n");
        result = (SCAbConfirmDeleteDirectory(aURI)
                  && SCDeleteDAVDirectory(aURI));
    }
    else {
        // 			dump("pouet dasdsa\n");
        let directory = SCGetDirectoryFromURI(aURI);
        if (!(directory.isMailList
              && _SCDeleteListAsDirectory(directory, aURI)))
            this.SCAbDeleteDirectoryOriginal(aURI);
    }
}

function _SCDeleteListAsDirectory(directory, selectedDir) {
    let result = false;

    // 	dump("_SCDeleteListAsDirectory\n");
    let uriParts = selectedDir.split("/");
    let parentDirURI = uriParts[0] + "//" + uriParts[2];
    if (isGroupdavDirectory(parentDirURI)) {
        // 		dump("_SCDeleteListAsDirectory 2\n");
        let attributes = new GroupDAVListAttributes(directory.URI);
        if (attributes.key) {
            // 			dump("_SCDeleteListAsDirectory 3\n");

            result = true;
            if (SCAbConfirmDelete(kSingleListOnly)) {
                // 				dump("_SCDeleteListAsDirectory 4\n");
                let parentDir = SCGetDirectoryFromURI(parentDirURI);
                let prefService = new GroupdavPreferenceService(parentDir.dirPrefId);
                deleteManager.begin(parentDirURI, 1);
                _deleteGroupDAVComponentWithKey(prefService, attributes.key,
                                                parentDir, directory, true);
            }
        }
    }

    return result;
}

function SCAbConfirmDeleteDirectory(selectedDir) {
    let confirmDeleteMessage;
    
    let prefBranch = (Components.classes["@mozilla.org/preferences-service;1"]
          .getService(Components.interfaces.nsIPrefBranch));


    // Check if this address book is being used for collection
    if (prefBranch.getCharPref("mail.collect_addressbook") == selectedDir
          && (prefBranch.getBoolPref("mail.collect_email_address_outgoing")
          || prefBranch.getBoolPref("mail.collect_email_address_incoming")
          || prefBranch.getBoolPref("mail.collect_email_address_newsgroup"))) {
        let brandShortName = document.getElementById("bundle_brand").getString("brandShortName");
        confirmDeleteMessage = gAddressBookBundle.getFormattedString("confirmDeleteCollectionAddressbook",
                                                                     [brandShortName]);
    }
    else
        confirmDeleteMessage = gAddressBookBundle.getString("confirmDeleteAddressbook");

    let promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                  .getService(Components.interfaces.nsIPromptService);

    return (promptService.confirm(window,
                                  gAddressBookBundle.getString("confirmDeleteAddressbookTitle"),
                                  confirmDeleteMessage));
}

function SCSynchronizeFromChildWindow(uri) {
    this.setTimeout(SynchronizeGroupdavAddressbook, 1, uri, null, 1);
}

let groupdavSynchronizationObserver = {
    oldPC: -1,
    syncManager: null,

    _createProgressBar: function() {
        let progressBar = document.createElement("progressmeter");
        progressBar.setAttribute("id", "groupdavProgressMeter");
        progressBar.setAttribute("mode", "determined");
        progressBar.setAttribute("value", "0%");

        return progressBar;
    },
    ensureProgressBar: function() {
        // 		dump("document: " + document + "\n");
        // 		dump("window: " + window + "\n");
        // 		dump("window.title: " + window.title + "\n");
        // 		dump("window.document: " + window.document + "\n");
        let progressBar = this._createProgressBar();
        let panel = document.getElementById("groupdavProgressPanel");
        panel.appendChild(progressBar);
        panel.setAttribute("collapsed", false);

        return progressBar;
    },
    handleNotification: function(notification, data) {
        let progressBar = document.getElementById("groupdavProgressMeter");
        if (notification == "groupdav.synchronization.start") {
            if (!progressBar)
                this.ensureProgressBar();
        }
        else if (notification == "groupdav.synchronization.stop") {
            if (progressBar) {
                let panel = document.getElementById("groupdavProgressPanel");
                panel.removeChild(progressBar);
                panel.setAttribute("collapsed", true);
            }
        }
        else if (notification == "groupdav.synchronization.addressbook.updated") {
            if (!progressBar)
                progressBar = this.ensureProgressBar();
            let pc = Math.floor(this.syncManager.globalProgress() * 100);
            if (this.oldPC != pc) {
                window.setTimeout(_updateProgressBar, 200, pc);
                this.oldPC = pc;
            }
        }
    }
};

function _updateProgressBar(pc) {
    let progressBar = document.getElementById("groupdavProgressMeter");
    if (progressBar)
        progressBar.setAttribute("value", pc + "%");
}

function SCOnLoad() {
    let appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
                            .getService(Components.interfaces.nsIXULRuntime);
    if (appInfo.OS == "Darwin") {
        let toolbar = document.getElementById("ab-bar2");
        toolbar.setAttribute("arch", "mac");
    }

    this.SCAbEditSelectedDirectoryOriginal = this.AbEditSelectedDirectory;
    this.AbEditSelectedDirectory = this.SCAbEditSelectedDirectory;
    this.SCAbDeleteOriginal = this.AbDelete;
    this.AbDelete = this.SCAbDelete;
    this.SCAbDeleteDirectoryOriginal = this.AbDeleteDirectory;
    this.AbDeleteDirectory = this.SCAbDeleteDirectory;

    /* drag and drop */
    abDirTreeObserver.SCOnDropOld = abDirTreeObserver.onDrop;
    abDirTreeObserver.onDrop = abDirTreeObserver.SCOnDrop;

    /* command updaters */
    this.SCCommandUpdate_AddressBookOld = this.CommandUpdate_AddressBook;
    this.CommandUpdate_AddressBook = this.SCCommandUpdate_AddressBook;
    this.SCGoUpdateGlobalEditMenuItemsOld = this.goUpdateGlobalEditMenuItems;
    this.goUpdateGlobalEditMenuItems = 	this.SCGoUpdateGlobalEditMenuItems;
    this.SCGoUpdateSelectEditMenuItemsOld = this.goUpdateSelectEditMenuItems;
    this.goUpdateSelectEditMenuItems = this.SCGoUpdateSelectEditMenuItems;

    let ctlOvl = new dirPaneControllerOverlay();

    // dir pane
    let aDirTree = document.getElementById("dirTree");
    if (aDirTree) {
        aDirTree.controllers.appendController(ctlOvl);
        // 		aDirTree.controllers.appendController(DirPaneController);
    }

    // results pane
    let gAbResultsTree = document.getElementById("abResultsTree");
    if (gAbResultsTree) {
        // 		gAbResultsTree.controllers.appendController(ResultsPaneController);
        gAbResultsTree.controllers.appendController(ctlOvl);
    }

    let nmgr = Components.classes["@inverse.ca/notification-manager;1"]
                         .getService(Components.interfaces.inverseIJSNotificationManager)
                         .wrappedJSObject;
    let smgr = Components.classes["@inverse.ca/sync-progress-manager;1"]
                         .getService(Components.interfaces.inverseIJSSyncProgressManager)
                         .wrappedJSObject;
    groupdavSynchronizationObserver.syncManager = smgr;
    nmgr.registerObserver("groupdav.synchronization.start",
                          groupdavSynchronizationObserver);
    nmgr.registerObserver("groupdav.synchronization.stop",
                          groupdavSynchronizationObserver);
    nmgr.registerObserver("groupdav.synchronization.addressbook.updated",
                          groupdavSynchronizationObserver);

    let popup = document.getElementById("abResultsTreeContext");
    if (popup) {
        popup.addEventListener("popupshowing", SCOnResultsTreeContextMenuPopup, false);
    }

    popup = document.getElementById("sc-categories-contextmenu-popup");
    if (popup) {
        popup.addEventListener("popupshowing", SCOnCategoriesContextMenuPopup, false);
    }
}

function SCOnResultsTreeContextMenuPopup(event) {
    if (this == event.target) { /* otherwise the reset will be executed when
                                 any submenu pops up too... */
        let cards = GetSelectedAbCards();
        let rootEntry = document.getElementById("sc-categories-contextmenu");
        rootEntry.disabled = (cards.length == 0);
        if (!rootEntry.disabled) {
            SCResetCategoriesContextMenu();
        }
    }
}

function SCResetCategoriesContextMenu() {
    let popup = document.getElementById("sc-categories-contextmenu-popup");
    while (popup.lastChild) {
        popup.removeChild(popup.lastChild);
    }

    let catsArray = SCContactCategories.getCategoriesAsArray();
    for (let i = 0; i < catsArray.length; i++) {
        let newItem = document.createElement("menuitem");
        newItem.setAttribute("label", catsArray[i]);
        newItem.setAttribute("type", "checkbox");
        newItem.setAttribute("autocheck", "false");
        newItem.addEventListener("click",
                                 SCOnCategoriesContextMenuItemCommand,
                                 false);
        popup.appendChild(newItem);
    }
}

function SCOnCategoriesContextMenuPopup(event) {
    let cards = GetSelectedAbCards();
    if (cards.length > 0) {
        let card = cards[0].QueryInterface(Components.interfaces.nsIAbCard);
        let cats = card.getProperty("Categories", "");
        if (cats.length > 0) {
            let catsArray = cats.split("\u001A");
            let popup = document.getElementById("sc-categories-contextmenu-popup");
            let popupItems = popup.getElementsByTagName("menuitem");
            for (var i = 0; i < popupItems.length; i++) {
                let popupItem = popupItems[i];
                if (popupItem.label
                    && catsArray.indexOf(popupItem.label) > -1) {
                    popupItem.setAttribute("checked", "true");
                }
            }
        }
    }
}

function SCOnCategoriesContextMenuItemCommand(event) {
    let cards = GetSelectedAbCards();
    if (cards.length > 0) {
        let requireSync = false;
        let abUri = GetSelectedDirectory();
        let category = this.label;
        let set = !this.hasAttribute("checked");
        for (let i = 0; i < cards.length; i++) {
            let card = cards[i];
            let cats = card.getProperty("Categories", "");
            let changed = false;
            if (cats.length > 0) {
                let catsArray = cats.split("\u001A");
                let catIdx = catsArray.indexOf(category);
                if (set) {
                    if (catIdx == -1) {
                        catsArray.push(category);
                        changed = true;
                    }
                }
                else {
                    if (catIdx > -1) {
                        catsArray.splice(catIdx, 1);
                        changed = true;
                    }
                }
                if (changed) {
                    cats = catsArray.join("\u001A");
                }
            }
            else {
                if (set) {
                    changed = true;
                    cats = category;
                }
            }
            if (changed) {
                requireSync = true;
                card.setProperty("Categories", cats);
                card.setProperty("groupDavVersion", "-1");
                let abManager = Components.classes["@mozilla.org/abmanager;1"]
                                          .getService(Components.interfaces.nsIAbManager);
                let ab = abManager.getDirectory(abUri);
                ab.modifyCard(card);
            }
        }
        if (requireSync) {
            if (isGroupdavDirectory(abUri)) {
                SynchronizeGroupdavAddressbook(abUri);
            }
        }
    }
}

function SCSetSearchCriteria(menuitem) {
    let criteria = menuitem.getAttribute("sc-search-criteria");
    if (criteria.length > 0) {
        gQueryURIFormat = "?(or(" + criteria + ",c,@V))"; // the "or" is important here
    }
    else {
        let prefBranch = (Components.classes["@mozilla.org/preferences-service;1"]
                .getService(Components.interfaces.nsIPrefBranch));
        let nameOrEMailSearch = prefBranch.getComplexValue("mail.addr_book.quicksearchquery.format",
                                                       Components.interfaces.nsIPrefLocalizedString).data;
        gQueryURIFormat = nameOrEMailSearch;
    }
    gSearchInput.setAttribute("emptytext", menuitem.getAttribute("label"));
    gSearchInput.focus();
    onEnterInSearchBar();
}

function SCOnUnload() {
    let nmgr = Components.classes["@inverse.ca/notification-manager;1"]
                         .getService(Components.interfaces.inverseIJSNotificationManager)
                         .wrappedJSObject;
    nmgr.unregisterObserver("groupdav.synchronization.start",
                            groupdavSynchronizationObserver);
    nmgr.unregisterObserver("groupdav.synchronization.stop",
                            groupdavSynchronizationObserver);
    nmgr.unregisterObserver("groupdav.synchronization.addressbook.updated",
                            groupdavSynchronizationObserver);
}

function SCCommandSynchronizeAbort() {
    SynchronizeGroupdavAddressbookAbort(gSelectedDir);
}

function SCCommandSynchronize() {
    SynchronizeGroupdavAddressbook(gSelectedDir, SCCommandSynchronizeCallback);
}

function SCCommandSynchronizeCallback(url, code, failures, datas) {
    dump("SCCommandSynchronizeCallback\n");
    dump("  url: " + url + "\n");
    dump("  code: " + code + "\n");
    for (let i in failures) {
        dump("  failure: " + i + "\n");
    }
}

window.addEventListener("load", SCOnLoad, false);
window.addEventListener("unload", SCOnUnload, false);
