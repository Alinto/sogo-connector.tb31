/* mozilla.utils.inverse.ca.js - This file is part of "SOGo Connector", a Thunderbird extension.
 *
 * Copyright: Inverse inc., 2006-2016
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

String.repeat = function(pattern, times) {
    let newString = "";

    for (let i = 0; i < times; i++) {
        newString += pattern;
    }

    return newString;
};

/* object dumper */
function objectDumper() {
}

objectDumper.prototype = {
    indent: 0,
    dump: function(object) {
        let text = "";

        let oType = typeof object;
        if (oType == "function")
            text += this._dumpFunction(object);
        else if (oType == "string"
                 || oType == "number")
        text += this._dumpString(object);
        else if (oType == "object")
        text += this._dumpObject(object);
        else if (oType == "undefined")
        text += "<undefined>";

        return text;
    },
    _dumpFunction: function(object) {
        return "<function: " + object.name + ">";
    },
    _dumpString: function(object) {
        return "" + object;
    },
    _dumpObject: function(object) {
        let text = "";

        if (object instanceof Array)
            text += this._dumpArray(object);
        else if (object instanceof Object)
        text += this._dumpCustomObject(object);
        else
            text += "<object: " + object + ">";

        return text;
    },
    _dumpArray: function(object) {
        let text = "[";

        if (object.length > 0) {
            text += this.dump(object[0]);
            for (let i = 1; i < object.length; i++) {
                text += ", " + this.dump(object[i]);
            }
        }
        else {
            text += "<empty array>";
        }
        text += "]";

        return text;
    },
    _dumpCustomObject: function(object) {
        let braceIndentation = String.repeat(" ", this.indent);
        let text = "{";

        this.indent += 2;
        let indentation = String.repeat(" ", this.indent);
        for (let key in object) {
            try {
                text += indentation + key + ": " + this.dump(object[key]) + "\n";
            }
            catch(e) {
                text += indentation + key + ":" + " (an exception occured)\n";
            }
        }
        this.indent -= 2;
        text += braceIndentation + "}";

        return text;
    }
};

function dumpObject(object) {
    let dumper = new objectDumper();
    return dumper.dump(object);
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
                //gAbView.deleteSelectedCards();
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

function DeleteGroupDAVCard(directory, card, deleteLocally) {
    let mdbDirectory = SCGetDirectoryFromURI(directory);
    let prefService = new GroupdavPreferenceService(mdbDirectory.dirPrefId);

    deleteManager.begin(directory, 1);
    let key = card.getProperty("groupDavKey", null);

    _deleteGroupDAVComponentWithKey(prefService, key, mdbDirectory, card, deleteLocally);
}

function _deleteGroupDAVComponentWithKey(prefService,
                                         key,
                                         directory,
                                         component,
                                         deleteLocally) {
    dump("\n\nwe delete: " + key + " with deleteLocally="+deleteLocally+"\n\n\n");
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

editContactInlineUI.deleteContact = function() {
  if (this._cardDetails.book.readOnly)
    return; /* double check we can delete this */

  /* hide before the dialog or the panel takes the first click */
  this.panel.hidePopup();

  var bundle = document.getElementById("bundle_editContact");
  if (!Services.prompt.confirm(window,
                               bundle.getString("deleteContactTitle"),
                               bundle.getString("deleteContactMessage")))
    return;  /* XXX would be nice to bring the popup back up here */

  let cardArray = Components.classes["@mozilla.org/array;1"]
                            .createInstance(Components.interfaces.nsIMutableArray);
  cardArray.appendElement(this._cardDetails.card, false);

  let originalBook = this._cardDetails.book;
  if (isGroupdavDirectory(originalBook.URI)) {
    DeleteGroupDAVCard(originalBook.URI, this._cardDetails.card, true);
  } else {
    MailServices.ab.getDirectory(this._cardDetails.book.URI).deleteCards(cardArray);
  }
}

editContactInlineUI.saveChanges = function() {
  // If we're a popup dialog, just hide the popup and return
  if (!this._writeable) {
    this.panel.hidePopup();
    return;
  }

  let originalBook = this._cardDetails.book;

  let abURI = document.getElementById("editContactAddressBookList").value;
  if (abURI != originalBook.URI) {
    this._cardDetails.book = MailServices.ab.getDirectory(abURI);
  }

  // We can assume the email address stays the same, so just update the name
  var newName = document.getElementById("editContactName").value;
  if (newName != this._cardDetails.card.displayName) {
    this._cardDetails.card.displayName = newName;
    this._cardDetails.card.setProperty("PreferDisplayName", true);
  }

  // Save the card
  if (this._cardDetails.book.hasCard(this._cardDetails.card)) {
    // Address book wasn't changed.
    if (isGroupdavDirectory(abURI))
    {
        let oldDavVersion = this._cardDetails.card.getProperty("groupDavVersion", "-1");
        this._cardDetails.card.setProperty("groupDavVersion", "-1");
        this._cardDetails.card.setProperty("groupDavVersionPrev", oldDavVersion);
    }
    this._cardDetails.book.modifyCard(this._cardDetails.card);
    if (isGroupdavDirectory(abURI))
    {
        SCSynchronizeFromChildWindow(abURI);
    }
  }
  else {
    // We changed address books for the card.

    // Add it to the chosen address book...
    if (isGroupdavDirectory(abURI)) {
        this._cardDetails.card.setProperty("groupDavVersion", "-1");
        this._cardDetails.card.setProperty("groupDavVersionPrev", "-1");
        this._cardDetails.book.addCard(this._cardDetails.card);
        SCSynchronizeFromChildWindow(abURI);
    } else {
      this._cardDetails.book.addCard(this._cardDetails.card);
    }

    // ...and delete it from the old place.
    let cardArray = Components.classes["@mozilla.org/array;1"]
                            .createInstance(Components.interfaces.nsIMutableArray);
    cardArray.appendElement(this._cardDetails.card, false);
    if (isGroupdavDirectory(originalBook.URI)) {
        DeleteGroupDAVCard(originalBook.URI, this._cardDetails.card, true);
    } else {
        originalBook.deleteCards(cardArray);
    }
  }

  this.panel.hidePopup();
}
