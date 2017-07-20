if (typeof Cc == 'undefined')
	var Cc = Components.classes;
if (typeof Ci == 'undefined')
	var Ci = Components.interfaces;
   
ReleasesOptions = {
   libraryartists : null,
   futuremonths : null,
   savesession : null,
   theme : null,
   compareby: null,
   enablepast: null,
   pastmonths: null,
   
   init : function () {
      this.savesession = Application.prefs.getValue("extensions.releases.savesession", false);
      this.libraryartists = Application.prefs.getValue("extensions.releases.libraryartists", true);
      this.futuremonths = Application.prefs.getValue("extensions.releases.futuremonths", 3);
      this.theme = Application.prefs.getValue("extensions.releases.theme", 1);
      this.compareby = Application.prefs.getValue("extensions.releases.compareby", 1);
      // this.enablepast = Application.prefs.getValue("extensions.releases.enablepast", false);
      // this.pastmonths = Application.prefs.getValue("extensions.releases.pastmonths", 1);
      
      document.getElementById("checksavesession").checked = this.savesession;
      document.getElementById("checklibraryartists").checked = this.libraryartists;      
      document.getElementById("menufuturemonths").selectedIndex = this.futuremonths - 1;
      document.getElementById("menutheme").selectedIndex = this.theme - 1;
      document.getElementById("menucompareby").selectedIndex = this.compareby - 1;
      // document.getElementById("checkenablepast").checked = this.enablepast;
      // document.getElementById("menupastmonths").selectedIndex = this.pastmonths - 1;
   },
   
   save : function () {
      this.savesession = document.getElementById("checksavesession").checked;
      this.libraryartists = document.getElementById("checklibraryartists").checked;
      this.futuremonths = parseInt(document.getElementById("menufuturemonths").selectedItem.value);
      this.theme = parseInt(document.getElementById("menutheme").selectedItem.value);
      this.compareby = parseInt(document.getElementById("menucompareby").selectedItem.value);
      // this.enablepast = document.getElementById("checkenablepast").checked;
      // this.pastmonths = parseInt(document.getElementById("menupastmonths").selectedItem.value);
      
      Application.prefs.setValue("extensions.releases.savesession", this.savesession);
      Application.prefs.setValue("extensions.releases.libraryartists", this.libraryartists);
      Application.prefs.setValue("extensions.releases.futuremonths", this.futuremonths);
      Application.prefs.setValue("extensions.releases.theme", this.theme);
      Application.prefs.setValue("extensions.releases.compareby", this.compareby);
      // Application.prefs.setValue("extensions.releases.enablepast", this.enablepast);
      // Application.prefs.setValue("extensions.releases.pastmonths", this.pastmonths);
      
      window.close();
   },
};