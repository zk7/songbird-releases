if (typeof(Cc) == 'undefined')
	var Cc = Components.classes;
if (typeof(Ci) == 'undefined')
	var Ci = Components.interfaces;
if (typeof(Cr) == 'undefined')
	var Cr = Components.results;
   
// Make a namespace.
if (typeof Releases == 'undefined') {
  var Releases = {};
}

//Singleton releases object
Releases = {

  /**
   * Called when the window finishes loading
   */
  relDB: null,
  onLoad: function() {
    // initialization code
    this.initialized = true;
    this.strings = document.getElementById("releases-strings");
    // Perform extra actions the first time the extension is run
    if (Application.prefs.get("extensions.releases.firstrun").value) {
      Application.prefs.setValue("extensions.releases.firstrun", false);
    } 
    this.setupServicePaneNode();
    //register uninstall observer
    this.uninstallObserver.register();
	
	relDB = Cc["@songbirdnest.com/Songbird/DatabaseQuery;1"]
		 .createInstance(Ci.sbIDatabaseQuery);
    var ios = Cc["@mozilla.org/network/io-service;1"]
		 .createInstance(Ci.nsIIOService);
    var dbdir = Cc["@mozilla.org/file/directory_service;1"]
		 .createInstance(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
    relDB_URI = ios.newFileURI(dbdir);
    relDB.databaseLocation = relDB_URI;
    relDB.setDatabaseGUID("releases");
    relDB.setAsyncQuery(false);
	 relDB.resetQuery();
	 relDB.addQuery("CREATE TABLE IF NOT EXISTS releases (id INTEGER PRIMARY KEY, " +
		   "date TEXT, artist TEXT, title TEXT, label TEXT, type TEXT, " +
		   "tracks TEXT, country TEXT, gcaldate TEXT)");
    relDB.addQuery("CREATE TABLE IF NOT EXISTS filters (id INTEGER PRIMARY KEY, " +
         "artist TEXT, label TEXT, country TEXT, persist INTEGER, exclude INTEGER)");
    relDB.execute();
  },  
  
  /**
   * Called when the window is about to close
   */
  onUnLoad: function() {
   this.initialized = false;    
   
   relDB.resetQuery();
   relDB.addQuery("DELETE from filters where persist = 0");   
   //check to see if we want to save releases DB
   if (Application.prefs.getValue("extensions.releases.savesession", false) == false){
      relDB.addQuery("DELETE from releases");      
   }
   relDB.execute();
  },
  
  setupServicePaneNode : function() {
		var SPS = Cc['@songbirdnest.com/servicepane/service;1'].
				getService(Ci.sbIServicePaneService);
		SPS.init();
		var rrNode = SPS.getNode("urn:releases");
		if (rrNode == null) {
			rrNode = SPS.addNode("urn:releases", SPS.root, false);
         if (rrNode == null) alert(this.strings.getString("servicePaneError"));
         else{
   			rrNode.url = "chrome://releases/content/main.xul";
   			rrNode.name = this.strings.getString("servicePaneTitle");
   			rrNode.tooltip = this.strings.getString("servicePaneTooltip");
   			rrNode.properties = "releases";
   			rrNode.setAttributeNS("http://songbirdnest.com/rdf/servicepane#", "Weight", -3);
   			SPS.sortNode(rrNode);
         }
         SPS.save();
      }
		// else {
         //node already exists
		//}
      
		// outside the loop in case we're going from disabled->enabled
		rrNode.hidden = false;
	},

  
};

Releases.uninstallObserver = {
	_uninstall : false,
	_disable : false,
	
	observe : function(subject, topic, data) {
		switch(topic) {
			case "em-action-requested":
				// Extension has been flagged to be uninstalled
				subject.QueryInterface(Ci.nsIUpdateItem);
            
				var SPS = Cc['@songbirdnest.com/servicepane/service;1'].
					getService(Ci.sbIServicePaneService);
				SPS.init();
				var rrNode = SPS.getNode("urn:releases");

				if (subject.id == "releases@songbirdnest.com") {
					if (data == "item-uninstalled") {
						this._uninstall = true;
					} else if (data == "item-disabled") {
						this._disable = true;
						rrNode.hidden = true;
					} else if (data == "item-cancel-action") {
						if (this._uninstall)
							this._uninstall = false;
						if (this._disable)
							rrNode.hidden = false;
					}
				}
				break;
			case "quit-application-granted":
				if (this._uninstall) {
               //Remove node
					var SPS = Cc['@songbirdnest.com/servicepane/service;1'].
                  getService(Ci.sbIServicePaneService);
               SPS.init();
               var rrNode = SPS.getNode("urn:releases");               
               SPS.removeNode(rrNode);
               
               //Clear prefs
               var prefs = Cc["@mozilla.org/preferences-service;1"]
         			.getService(Ci.nsIPrefService).getBranch("extensions.releases.");
         		if (prefs.prefHasUserValue("firstrun"))
         			prefs.clearUserPref("firstrun");
               if (prefs.prefHasUserValue("libraryartists"))
                  prefs.clearUserPref("libraryartists");
               if (prefs.prefHasUserValue("futuremonths"))
                  prefs.clearUserPref("futuremonths");
               if (prefs.prefHasUserValue("savesession"));
                  prefs.clearUserPref("savesession");
               if (prefs.prefHasUserValue("theme"))
                  prefs.clearUserPref("theme");   
               if (prefs.prefHasUserValue("compareby"))
                  prefs.clearUserPref("compareby");
               if (prefs.prefHasUserValue("enablepast"))
                  prefs.clearUserPref("enablepast");
               if (prefs.prefHasUserValue("pastmonths"))
                  prefs.clearUserPref("pastmonths");
         		prefs.deleteBranch("");
               
               //Remove DB               
               relDB.resetQuery();
               relDB.addQuery("DROP TABLE IF EXISTS releases");
               relDB.addQuery("DROP TABLE IF EXISTS filters");
               relDB.execute();
            }
			break;
		}
	},

	register : function() {
		var observerService = Cc["@mozilla.org/observer-service;1"]
			.getService(Ci.nsIObserverService);
		observerService.addObserver(this, "em-action-requested", false);
		observerService.addObserver(this, "quit-application-granted", false);
	},

	unregister : function() {
      var observerService = Cc["@mozilla.org/observer-service;1"]
			.getService(Ci.nsIObserverService);
		this.observerService.removeObserver(this, "em-action-requested");
		this.observerService.removeObserver(this, "quit-application-granted");
	},
};

window.addEventListener("load", function(e) { Releases.onLoad(e); }, false);
window.addEventListener("unload", function(e) { Releases.onUnLoad(e); }, false);
