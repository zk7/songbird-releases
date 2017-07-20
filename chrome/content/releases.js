if (typeof(Cc) == "undefined")
	var Cc = Components.classes;
if (typeof(Ci) == "undefined")
	var Ci = Components.interfaces;
if (typeof(Cu) == "undefined")
	var Cu = Components.utils;

if (typeof(SBProperties) == "undefined") {
    Cu.import("resource://app/jsmodules/sbProperties.jsm");
    if (!SBProperties)
        throw new Error("Import of sbProperties module failed");
}

if (typeof(LibraryUtils) == "undefined") {
    Cu.import("resource://app/jsmodules/sbLibraryUtils.jsm");
    if (!LibraryUtils)
        throw new Error("Import of sbLibraryUtils module failed");
}

var masterList = new Array();
var artistList = new Array();
var strings = document.getElementById("releases-strings");
var relDB;

function init() {
   var list = LibraryUtils.mainLibrary;   
   var artists, count;
   var currentArtist, rList;
   var ios, dbdir, relDB_URI;
   
   document.getElementById("bottomlabel").attributes.getNamedItem("value").value = strings.getString("loading") + "...";
   document.getElementById("progress").style.visibility='visible'; 
   document.getElementById("topbox").style.visibility='hidden';
   //Create our sqlite DB
   relDB = Cc["@songbirdnest.com/Songbird/DatabaseQuery;1"]
         .createInstance(Ci.sbIDatabaseQuery);
   ios = Cc["@mozilla.org/network/io-service;1"]
         .createInstance(Ci.nsIIOService);
   dbdir = Cc["@mozilla.org/file/directory_service;1"]
         .createInstance(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
   relDB_URI = ios.newFileURI(dbdir);
   relDB.databaseLocation = relDB_URI;
   relDB.setDatabaseGUID("releases");
   relDB.setAsyncQuery(false);
   relDB.resetQuery();

   // Populate artistList with distinct artists from main lib
   // Check preferences to see which metadata field to retrieve
   var fieldCheck = Application.prefs.getValue("extensions.releases.compareby", 1);
   artistList = new Array();
   if (fieldCheck == 1 || fieldCheck == 4){ //artist
      artists = list.getDistinctValuesForProperty(SBProperties.artistName);   
      while (artists.hasMore()) {   
         currentArtist = artists.getNext();
         artistList.push(currentArtist.toString());
      }
   }
	  
   if (fieldCheck == 2 || fieldCheck == 4) {
      artists = list.getDistinctValuesForProperty(SBProperties.albumArtistName); 
      while (artists.hasMore()) {   
         currentArtist = artists.getNext();
         artistList.push(currentArtist.toString());
      }
   }
   
   if (fieldCheck == 3 || fieldCheck == 4) {
      artists = list.getDistinctValuesForProperty(SBProperties.composerName);
      while (artists.hasMore()) {   
         currentArtist = artists.getNext();
         artistList.push(currentArtist.toString());
      }
   }
   
   //Get count to see if we already have releases
   count = -1;
   relDB.addQuery("select count(*) from releases");
   try{
      //try to execute query and get count
      relDB.execute();
      count = relDB.getResultObject().getRowCell(0, 0)
   }catch (e){
      //if cannot execute query, do full creation process
      count = 0;
   }
   if (count == 0){
     //Get a clean database
     resetDB(); 
      
     //Insert list of releases into DB
     getReleases();
   }
  populateFilter(); 
  //Print to screen
  addToDom();    
  document.getElementById("progress").style.visibility='hidden';
  document.getElementById("topbox").style.visibility='visible';
}   

/**
* Get all releases for time period
**/
function getReleases() {   
   var monthInMillis = 3600*24*1000*30; //30 days
   var now = new Date();  
   var monthsToGet = Application.prefs.getValue("extensions.releases.futuremonths", 3);
   var pastMonthsToGet = 0;
   var year, month, go, i;
   var iframe = document.getElementById("release-listings").contentWindow.document;
      
   document.getElementById("bottomlabel").attributes.getNamedItem("value").value = strings.getString("loading") + "...";
   
   now.setDate(15); //set to middle-of-month
   if (Application.prefs.getValue("extensions.releases.enablepast", false) == true){
      pastMonthsToGet = Application.prefs.getValue("extensions.releases.pastmonths", 1);
      now.setTime(now.getTime() - monthInMillis*pastMonthsToGet); //subtract months
   }

   
   for (i = 0-pastMonthsToGet; i < monthsToGet; i++){      
      //build date string
      year = now.getFullYear();
      if (now.getMonth() < 9) month = "0" + (now.getMonth()+1);
      else month = (now.getMonth()+1);
      
      //get releases for that month
      go = populateMasterList(year, month);
      if (!go) return new Array();
      //advance month by adding 32 days
      now.setTime(now.getTime() + monthInMillis);
   }
   
   //parse masterList and put releases into DB
   addToDB();
   return;
}
      

/**
* Get list of albums from MusicBrainz webservice
**/
function populateMasterList(year, month){
   var date = year + "-" + month + "-**";
   var releaseList = new Array();
   var iframe = document.getElementById("release-listings").contentWindow.document;
   var monthArray = new Array("January","February","March",
			"April","May","June","July","August","September","October","November","December");
   var htmlString = "<div class='centerdiv' " + 
		"style='margin-left:auto; margin-right: auto; margin-top:50px; text-align:center; line-height: 4em; font-family: arial, sans-serif; font-size: 12px'>" + 
		strings.getString("centerMessage") + " " + monthArray[month - 1] + " " + year + "...</div>";
   iframe.getElementsByTagName("body")[0].innerHTML = htmlString;
   
   try{
      pause(1000); //pause for 1 sec before http request. This is due to musicbrainz webservice rules.
      var req = new XMLHttpRequest();   
      req.open("GET",
         "http://musicbrainz.org/ws/1/release/?type=xml&limit=100&date=" + date, false);
      req.send(null);
   }
   catch (e) {
      alert(strings.getString("connectionError"));
      return false;
   }
   var xml = (new DOMParser()).parseFromString(req.responseText, "text/xml");   
   if (xml.getElementsByTagName("release-list")[0] != null){
	   var count = xml.getElementsByTagName("release-list")[0].attributes.getNamedItem("count").nodeValue;
	   releaseList = xml.getElementsByTagName("release");
	   masterList.push(releaseList);
	   
	   if (count > 100){ //query the rest using offset param
		  var counterElement = iframe.getElementById("counter");
		  for (var i = 100; i < count; i+=100){
			 pause(1000); //pause for 1 sec before http request. This is due to musicbrainz webservice rules.
			 req.open("GET",
				"http://musicbrainz.org/ws/1/release/?type=xml&limit=100&date=" + date + "&offset=" + i, false);
			 req.send(null);
			 var xml = (new DOMParser()).parseFromString(req.responseText, "text/xml");
			 releaseList = xml.getElementsByTagName("release");
			 masterList.push(releaseList);
			 document.getElementById("bottomlabel").attributes.getNamedItem("value").value = strings.getString("retrieved") + " " + i + "/" + count;
		  }      
	   }
	}
   return true;
}

/**
 * Parse and filter raw MusicBrainz xml data and add releases to DB
**/
function addToDB(){
   var i, j, k, curRelease, query;
   var releaseTypeNode, titleNode, artistNode, eventNodes, curEventNode, eventDateNode, labelNode, trackCountNode, countryNode;
   var releaseType, title, artist, eventDate, label, trackCount, country, onlyLibArtists, gcalDate;
   var oldCountry = null, oldDate = null;
   var releaseDate = null;
   var now = new Date();
   var id = 1;
   
   //Loop through masterList
   for (i = 0; i < masterList.length; i++){
      for (j = 0; j < masterList[i].length; j++){
         curRelease = masterList[i][j];
         
         artistNode = curRelease.getElementsByTagName("artist")[0].getElementsByTagName("name")[0].childNodes[0];
         releaseTypeNode = curRelease.attributes.getNamedItem("type");
         titleNode = curRelease.getElementsByTagName("title")[0].childNodes[0];
         trackCountNode = curRelease.getElementsByTagName("track-list")[0].attributes.getNamedItem("count");
         
         if (releaseTypeNode != null) releaseType = releaseTypeNode.nodeValue;
         else releaseType = strings.getString("Unknown");
         if (titleNode != null) title = titleNode.nodeValue;
         else title = strings.getString("Unknown");
         if (artistNode != null) artist = artistNode.nodeValue;
         else artist = strings.getString("Unknown");    
         if (trackCountNode != null) trackCount = trackCountNode.nodeValue;
         else trackCount = strings.getString("Unknown");
         
         query = 'select count(*) from releases where artist = "' + escape(artist) + '" and title = "' + escape(title) + '"';
         relDB.resetQuery();
         relDB.addQuery(query);
         relDB.execute();
         if (relDB.getResultObject().getRowCell(0,0) == 0){ //continue if we dont already have this release
            
         eventNodes = curRelease.getElementsByTagName("release-event-list")[0].getElementsByTagName("event");     
			oldCountry = null;
			oldDate = null;
            for (k = 0; k < eventNodes.length; k++){
               curEventNode = eventNodes[k];
               if (curEventNode.getElementsByTagName("label").length > 0)
                  labelNode = curEventNode.getElementsByTagName("label")[0].getElementsByTagName("name")[0].childNodes[0];               
               countryNode = curEventNode.attributes.getNamedItem("country");
               eventDateNode = curEventNode.attributes.getNamedItem("date");
            
               if (labelNode != null) label = labelNode.nodeValue;
               else label = strings.getString("Unknown");
               if (countryNode != null) country = getCountry(countryNode.nodeValue);
               else country = strings.getString("Unknown");
               if (eventDateNode != null) eventDate = eventDateNode.nodeValue;
               else eventDate = strings.getString("Unknown");           
            
               //get date and check if it is in the future
               releaseDate = new Date(eventDate.replace(/-/g, "/"));	 
               gcalDate = releaseDate.toLocaleFormat("%Y%m%d");
			   
               //check that we dont have this event already
               //duplicates caused by different barcodes (which we don't read)
               if (country == oldCountry && gcalDate == oldDate) continue;               
               
               //if release is in the future, add to DB
               if (releaseDate.getTime() > now.getTime()){ 
                  //remove " from strings
                  title = title.replace(/"/g, "'");
                  artist = artist.replace(/"/g, "'");
                  label = label.replace(/"/g, "'");
               
                  query = 'insert into releases values ( ' +
                     id + ', "' +
                     (releaseDate.getMonth() + 1) + "/" + releaseDate.getDate() + "/" + releaseDate.getFullYear() + '", "' +
                     artist + '", "' +
                     title + '", "' +
                     label + '", "' +
                     releaseType + '", "' +
                     trackCount + '", "' +
                     country + '", "' +
                     gcalDate + '" )';
                  relDB.resetQuery();
                  relDB.addQuery(query);
                  relDB.execute();
                  
                  oldCountry = country;
                  oldDate = gcalDate;
              
                  id++; //increment our id
               }
            }
         }
      }
   }
}
         

/**
 * Populate filter lists
**/
function populateFilter(){
   var p, i, sel = 0;
   var curProp, curElement, curFilter, listItem, menu;
   var query, result, filterResult, selected;
   var propertiesArray = new Array("artist", "label", "country");
   
   query = "select * from filters where exclude = 0";
   relDB.resetQuery();
   relDB.addQuery(query);
   relDB.execute();
   filterResult = relDB.getResultObject();
   
   for (p = 0; p < propertiesArray.length; p++){
      curProp = propertiesArray[p];
      menu = document.getElementById(curProp + "popup");
      curFilter = filterResult.getRowCellByColumn(0, curProp);
      
      //remove all childNodes from menulist
      if (menu.hasChildNodes()){
         while (menu.childNodes.length >= 1){
            menu.removeChild(menu.firstChild);
         }
      }
      
      //add first 'All' option
      listItem = document.createElement("menuitem");         
      listItem.setAttribute("label", "All");
      listItem.setAttribute("value", "all");
      menu.appendChild(listItem);
      
      query = "select distinct " + curProp + " from releases";
      relDB.resetQuery();
      relDB.addQuery(query);
      relDB.execute();
      result = relDB.getResultObject();
      
      for (i = 0; i < result.getRowCount(); i++){
         curElement = result.getRowCellByColumn(i, curProp);
         listItem = document.createElement("menuitem");         
         listItem.setAttribute("label", curElement);
         listItem.setAttribute("value", curElement);
         if (curElement == curFilter){         
            listItem.setAttribute("selected", "true");
            sel = i+1;
         }
         menu.appendChild(listItem);
      }      
      if (curFilter == null || curFilter == "all")
         document.getElementById(curProp + "list").selectedIndex = 0;
      else
         document.getElementById(curProp + "list").selectedIndex = sel;
   }
}
         
/**
 * Given a list of releases, add them to the iframe
**/
function addToDom(){
   var i, htmlString;
	var iframe = document.getElementById("release-listings").contentWindow.document;
   var strRelease, strLabel, strtracks;
   var date, artist, title, type, label, country, gcaldate, gcaldateplus;
   var gcalLink, artistLink, albumLink, labelLink;
   var query, result;
   var count = 0;
   var artistFilter = document.getElementById("artistlist").value;
   var labelFilter = document.getElementById("labellist").value;
   var countryFilter = document.getElementById("countrylist").value;
   
   //get pref to see to filter by library artists only
   var onlyLibArtists = Application.prefs.getValue("extensions.releases.libraryartists", true);
   
   // Apply styles to the iframe
	var headNode = iframe.getElementsByTagName("head")[0];
	var cssNode = iframe.createElementNS("http://www.w3.org/1999/xhtml", "html:link");
	cssNode.type = 'text/css';
	cssNode.rel = 'stylesheet';
   if (Application.prefs.getValue("extensions.releases.theme", 1) == 1)
      cssNode.href = 'chrome://releases/skin/theme-light.css';
   else
      cssNode.href = 'chrome://releases/skin/theme-dark.css';
	headNode.appendChild(cssNode);
   
   //Create table in DOM
   htmlString = "<table class='sortable' id='sortabletable'>" +
      " <thead> " +
      " <tr>" +
      " <th class='date'> " + strings.getString("dateHeader") + " </th>" +
      " <th class='artist'> " + strings.getString("artistHeader") + " </th>" +
      " <th> " + strings.getString("releaseHeader") + " </th>" +
      " <th> " + strings.getString("labelHeader") + "</th>" +
      " <th> " + strings.getString("countryHeader") + "</th>" +
      " </tr>" + 
      " </thead> " +
      " <tbody></tbody> " +
      " </table>";
   iframe.getElementsByTagName("body")[0].innerHTML = htmlString;
   
   //Query for releases in DB matching filter
   query = "select r.* from releases r where 1=1 ";
   if (artistFilter != "all"){
      query += " and r.artist = \"" + artistFilter + "\"";
      onlyLibArtists = false; //if we have specific artist filter - just show it
   }
   if (labelFilter != "all")
      query += " and r.label = \"" + labelFilter + "\"";
   if (countryFilter != "all")
      query += " and r.country = \"" + countryFilter + "\"";
   relDB.resetQuery();
   relDB.addQuery(query);
   relDB.execute();
   result = relDB.getResultObject();
   
   //Fill table
   for (i = 0; i < result.getRowCount(); i++){
      artist = result.getRowCellByColumn(i, "artist");
      if (onlyLibArtists){
         if (artistList.containsString(artist) == false) continue;
      }
      date = result.getRowCellByColumn(i, "date");
      title = result.getRowCellByColumn(i, "title");
      type = result.getRowCellByColumn(i, "type");
      label = result.getRowCellByColumn(i, "label");
      country = result.getRowCellByColumn(i, "country");
      gcaldate = result.getRowCellByColumn(i, "gcaldate");
      //Fix for google changing gcaldate all day event to be date - date+1
      gcaldateplus = new Date(Date.parse(date));
      gcaldateplus.setDate(gcaldateplus.getDate() + 1);
      gcaldateplus = gcaldateplus.toLocaleFormat("%Y%m%d");
      
      gcalLink = "<a href='http://www.google.com/calendar/event?action=TEMPLATE";
      gcalLink += "&text=" + escape(strings.getString("gcalTitle") + " -- " + title + " by " + artist);
      gcalLink += "&details=" + escape(strings.getString("infoRelease") + ": " + type + "\n" + strings.getString("labelHeader") + ": " + label);
      gcalLink += "&location=" + escape(country);
      gcalLink += "&dates=" + gcaldate + "/" + gcaldateplus;
      gcalLink += "' target='_blank'> " + strings.getString("gcal") + " </a>";
      
      // Allmusic search option
	  // Artist:1 Album:2 Song:3 Style:4 Label:5
      
      artistLink = "<a href='http://www.allmusic.com/cg/amg.dll?P=amg&opt1=1";
      artistLink += "&sql=" + escape(artist);
      artistLink += "' target='_blank'> " + artist + " </a>";
	  
	  labelLink = "<a href='http://www.allmusic.com/cg/amg.dll?P=amg&opt1=5";
      labelLink += "&sql=" + label.replace(/ /g, "+");
      labelLink += "' target='_blank'> " + label + " </a>";
	  
	  albumLink = "<a href='http://www.allmusic.com/cg/amg.dll?P=amg&opt1=2";
      albumLink += "&sql=" + escape(title);
      albumLink += "' target='_blank'> " + title + " </a>";
      
      htmlString = " <tr>" +
      " <td class='date'> " + date + " </td>" + 
      " <td class='artist'> " + artistLink + " </td>" +
      " <td class='release'> " + albumLink + 
      " <span class='gcalLink'> " + gcalLink + "</span> <br>" +
      " <span class='addInfo'> " + strings.getString("infoRelease") + ": " + type + " </span>" +
      " <span class='addInfo'> " + result.getRowCellByColumn(i, "tracks") + " " + strings.getString("infoTracks") + " </span>" +
      " <td class='label'> " + labelLink + " <br>" +
      " <td class='country'> " + country + " </td>" +
      " </tr> ";
      iframe.getElementsByTagName("tbody")[0].innerHTML += htmlString;
      
      count++;
   }
   
   //Change status text
   document.getElementById("bottomlabel").attributes.getNamedItem("value").value = 
      strings.getString("loaded") + " " + count + " " + strings.getString("results");
   
   if (iframe.getElementsByTagName("tbody")[0].innerHTML == ""){
      htmlString = "<div style='text-align: center'>" + strings.getString("emptyMessage") + "</div>";
      iframe.getElementsByTagName("body")[0].innerHTML += htmlString;
      return;
   }   
   
   //Call sortable script to make table sortable
   top.frames[0].sortables_init();
}

/**
 * Set filter and reload list
**/
function setFilters(){
   var artistFilter, labelFilter, countryFilter;
   var query;
   
   artistFilter = document.getElementById("artistlist").value;
   labelFilter = document.getElementById("labellist").value;
   countryFilter = document.getElementById("countrylist").value;
   
   relDB.resetQuery();
   query = "DELETE from filters where exclude = 0";
   relDB.addQuery(query);
   query = "INSERT INTO filters (artist, label, country, persist, exclude) VALUES ('" + artistFilter + "', '" +
      labelFilter + "', '" + countryFilter + "', 0, 0)";
   relDB.addQuery(query);
   relDB.execute();
   
   init();
}

/**
 * Open options window
**/
function openOptions(){
   var optWindow = window.openDialog("chrome://releases/content/options.xul", 
		"", "dependent=yes,modal=yes,chrome=yes,centerscreen=yes,dialog=yes");
}


/**
 * Cleanup
**/
function unload(){
   //currently nothing
}

/**************************Support Functions************************************/

/**
* Really bad pause function
**/
function pause(millis) 
{
   var date = new Date();
   var curDate = null;

   do { curDate = new Date(); } 
   while(curDate-date < millis);
} 

/**
* Drop and recreate releases DB
**/
function resetDB(){
   relDB.resetQuery();
   relDB.addQuery("DELETE from releases");
   relDB.execute();
}

/**
* MusicBrainz country codes
* Taken from http://wiki.musicbrainz.org/Release_Country
**/
function getCountry(code){
   switch(code){
      case "AF": return "Afghanistan";
      case "AX": return "Åland Islands";
      case "AL": return "Albania";
      case "DZ": return "Algeria";
      case "AS": return "American Samoa";
      case "AD": return "Andorra";
      case "AO": return "Angola";
      case "AI": return "Anguilla";
      case "AQ": return "Antarctica";
      case "AG": return "Antigua and Barbuda";
      case "AR": return "Argentina";
      case "AM": return "Armenia";
      case "AW": return "Aruba";
      case "AU": return "Australia";
      case "AT": return "Austria";
      case "AZ": return "Azerbaijan";
      case "BS": return "Bahamas";
      case "BH": return "Bahrain";
      case "BD": return "Bangladesh";
      case "BB": return "Barbados";
      case "BY": return "Belarus";
      case "BE": return "Belgium";
      case "BZ": return "Belize";
      case "BJ": return "Benin";
      case "BM": return "Bermuda";
      case "BT": return "Bhutan";
      case "BO": return "Bolivia";
      case "BA": return "Bosnia and Herzegovina";
      case "BW": return "Botswana";
      case "BV": return "Bouvet Island";
      case "BR": return "Brazil";
      case "IO": return "British Indian Ocean Territory";
      case "BN": return "Brunei Darussalam";
      case "BG": return "Bulgaria";
      case "BF": return "Burkina Faso";
      case "BI": return "Burundi";
      case "KH": return "Cambodia";
      case "CM": return "Cameroon";
      case "CA": return "Canada";
      case "CV": return "Cape Verde";
      case "KY": return "Cayman Islands";
      case "CF": return "Central African Republic";
      case "TD": return "Chad";
      case "CL": return "Chile";
      case "CN": return "China";
      case "CX": return "Christmas Island";
      case "CC": return "Cocos (Keeling) Islands";
      case "CO": return "Colombia";
      case "KM": return "Comoros";
      case "CG": return "Congo";
      case "CD": return "Congo";
      case "CK": return "Cook Islands";
      case "CR": return "Costa Rica";
      case "CI": return "Cote d'Ivoire";
      case "HR": return "Croatia";
      case "CU": return "Cuba";
      case "CY": return "Cyprus";
      case "XC": return "Czechoslovakia";      
      case "CZ": return "Czech Republic";
      case "DK": return "Denmark";
      case "DJ": return "Djibouti";
      case "DM": return "Dominica";
      case "DO": return "Dominican Republic";
      case "XG": return "East Germany";      
      case "EC": return "Ecuador";
      case "EG": return "Egypt";
      case "SV": return "El Salvador";
      case "GQ": return "Equatorial Guinea";
      case "ER": return "Eritrea";
      case "EE": return "Estonia";
      case "ET": return "Ethiopia";
      case "XE": return "Europe";
      case "FK": return "Falkland Islands (Malvinas)";
      case "FO": return "Faroe Islands";
      case "FJ": return "Fiji";
      case "FI": return "Finland";
      case "FR": return "France";      
      case "GF": return "French Guiana";
      case "PF": return "French Polynesia";      
      case "TF": return "French Southern Territories";
      case "GA": return "Gabon";      
      case "GM": return "Gambia";
      case "GE": return "Georgia";      
      case "DE": return "Germany";
      case "GH": return "Ghana";      
      case "GI": return "Gibraltar";
      case "GR": return "Greece";
      case "GL": return "Greenland";
      case "GD": return "Grenada";
      case "GP": return "Guadeloupe";
      case "GU": return "Guam";
      case "GT": return "Guatemala";
      case "GG": return "Guernsey";
      case "GN": return "Guinea";
      case "GW": return "Guinea-Bissau";
      case "GY": return "Guyana";
      case "HT": return "Haiti";
      case "HM": return "Heard and Mc Donald Islands";
      case "HN": return "Honduras";
      case "HK": return "Hong Kong";
      case "HU": return "Hungary";
      case "IS": return "Iceland";
      case "IN": return "India";
      case "ID": return "Indonesia";
      case "IR": return "Iran";
      case "IQ": return "Iraq";
      case "IE": return "Ireland";
      case "IM": return "Isle of Man";
      case "IL": return "Israel";
      case "IT": return "Italy";
      case "JM": return "Jamaica";
      case "JP": return "Japan";
      case "JE": return "Jersey";
      case "JO": return "Jordan";
      case "KZ": return "Kazakhstan";
      case "KE": return "Kenya";
      case "KI": return "Kiribati";
      case "KP": return "Korea (North)";
      case "KR": return "Korea (South)";
      case "KW": return "Kuwait";
      case "KG": return "Kyrgyzstan";
      case "LA": return "Lao People's Democratic Republic";
      case "LV": return "Latvia";
      case "LB": return "Lebanon";      
      case "LS": return "Lesotho";
      case "LR": return "Liberia";
      case "LY": return "Libyan Arab Jamahiriya";
      case "LI": return "Liechtenstein";
      case "LT": return "Lithuania";
      case "LU": return "Luxembourg";
      case "MO": return "Macau";
      case "MK": return "Macedonia";
      case "MG": return "Madagascar";
      case "MW": return "Malawi";
      case "MY": return "Malaysia";
      case "MV": return "Maldives";
      case "ML": return "Mali";
      case "MT": return "Malta";
      case "MH": return "Marshall Islands";
      case "MQ": return "Martinique";
      case "MR": return "Mauritania";
      case "MU": return "Mauritius";
      case "YT": return "Mayotte";
      case "MX": return "Mexico";
      case "FM": return "Micronesia";
      case "MD": return "Moldova";
      case "MC": return "Monaco";
      case "MN": return "Mongolia";
      case "ME": return "Montenegro";
      case "MS": return "Montserrat";
      case "MA": return "Morocco";
      case "MZ": return "Mozambique";
      case "MM": return "Myanmar";
      case "NA": return "Namibia";
      case "NR": return "Nauru";
      case "NP": return "Nepal";
      case "NL": return "Netherlands";
      case "AN": return "Netherlands Antilles";
      case "NC": return "New Caledonia";
      case "NZ": return "New Zealand";
      case "NI": return "Nicaragua";
      case "NE": return "Niger";
      case "NG": return "Nigeria";
      case "NU": return "Niue";
      case "NF": return "Norfolk Island";
      case "MP": return "Northern Mariana Islands";
      case "NO": return "Norway";
      case "OM": return "Oman";
      case "PK": return "Pakistan";
      case "PW": return "Palau";
      case "PS": return "Palestinian Territory";
      case "PA": return "Panama";
      case "PG": return "Papua New Guinea";
      case "PY": return "Paraguay";
      case "PE": return "Peru";
      case "PH": return "Philippines";
      case "PN": return "Pitcairn";
      case "PL": return "Poland";
      case "PT": return "Portugal";
      case "PR": return "Puerto Rico";
      case "QA": return "Qatar";
      case "RE": return "Reunion";
      case "RO": return "Romania";
      case "RU": return "Russian Federation";
      case "RW": return "Rwanda";
      case "BL": return "Saint Barthélemy";
      case "SH": return "Saint Helena";
      case "KN": return "Saint Kitts and Nevis";
      case "LC": return "Saint Lucia";
      case "MF": return "Saint Martin";
      case "PM": return "Saint Pierre and Miquelon";
      case "VC": return "Saint Vincent and The Grenadines";
      case "WS": return "Samoa";
      case "SM": return "San Marino";
      case "ST": return "Sao Tome and Principe";
      case "SA": return "Saudi Arabia";
      case "SN": return "Senegal";
      case "RS": return "Serbia";
      case "CS": return "Serbia and Montenegro";
      case "SC": return "Seychelles";
      case "SL": return "Sierra Leone";
      case "SG": return "Singapore";
      case "SK": return "Slovakia";
      case "SI": return "Slovenia";
      case "SB": return "Solomon Islands";
      case "SO": return "Somalia";
      case "ZA": return "South Africa";
      case "GS": return "South Georgia and the South Sandwich Islands";
      case "SU": return "Soviet Union";     
      case "ES": return "Spain";
      case "LK": return "Sri Lanka";
      case "SD": return "Sudan";
      case "SR": return "Suriname";
      case "SJ": return "Svalbard and Jan Mayen";
      case "SZ": return "Swaziland";
      case "SE": return "Sweden";
      case "CH": return "Switzerland";
      case "SY": return "Syrian Arab Republic";
      case "TW": return "Taiwan";
      case "TJ": return "Tajikistan";
      case "TZ": return "Tanzania, United Republic of";
      case "TH": return "Thailand";
      case "TL": return "Timor-Leste";
      case "TG": return "Togo";
      case "TK": return "Tokelau";
      case "TO": return "Tonga";
      case "TT": return "Trinidad and Tobago";
      case "TN": return "Tunisia";
      case "TR": return "Turkey";
      case "TM": return "Turkmenistan";
      case "TC": return "Turks and Caicos Islands";
      case "TV": return "Tuvalu";
      case "UG": return "Uganda";
      case "UA": return "Ukraine";
      case "AE": return "United Arab Emirates";
      case "GB": return "United Kingdom";
      case "US": return "United States";
      case "UM": return "United States Minor Outlying Islands";
      case "XU": return "Unknown";
      case "UY": return "Uruguay";
      case "UZ": return "Uzbekistan";
      case "VU": return "Vanuatu";
      case "VA": return "Vatican City State";
      case "VE": return "Venezuela";
      case "VN": return "Viet Nam";
      case "VG": return "Virgin Islands, British";
      case "VI": return "Virgin Islands, U.S.";
      case "WF": return "Wallis and Futuna Islands";
      case "EH": return "Western Sahara";
      case "XW": return "Worldwide";
      case "YE": return "Yemen";
      case "YU": return "Yugoslavia";      
      case "ZM": return "Zambia";
      case "ZW": return "Zimbabwe";
   }
}

/**
* Adding contains method to array
**/
Array.prototype.containsString = function(strVal) {
  var i = this.length;
  while (i--) {
    if (this[i].toLowerCase() === strVal.toLowerCase()) {
      return true;
    }
  }
  return false;
}