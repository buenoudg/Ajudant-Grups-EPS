// ==UserScript==
// @name        Ajudant UdGMoodle
// @namespace   http://atc.udg.edu/~bueno/
// @description Millores al Moodle de la UdG - VERSIÓ MOLT PRELIMINAR
// @include     /^http://moodle2\.udg\.edu/.+$/
// @version     0.0.2
// @require     http://code.jquery.com/jquery-2.1.4.min.js
// @require     http://code.jquery.com/ui/1.11.4/jquery-ui.min.js
// @grant       GM_getResourceText
// @grant       GM_addStyle
// @grant       GM_setValue
// @grant       GM_getValue
// ==/UserScript==

/* Changelog:
- v0.01  - Versió inicial
- v0.02  - RegExp de la llista d'estudiants actualitzada (ara inclou e-mail)
*/

// Totes les modificacions fan servir jQuery i s'executen una vegada la pàgina s'ha carregat
$(document).ready(function() {
	// Ajuda a seleccionar automàticament els alumnes a afegir a un grup
	if ((window.location.pathname == "/group/") || (window.location.pathname == "/group/index.php")) {
		GM_addStyle("#hackdata {float:left;margin-right:5%;width:15%;height:30em;background-color:#FFC}");
		GM_addStyle("#groupeditform div.groups, #groupeditform div.members {width:39%}");
		$("#groupeditform>div").prepend('<textarea id="hackdata">');
		var hackData = GM_getValue("hackData");
		if (hackData == "")
			hackData = "Enganxa aquí els números UdG i els grups";
		$("#hackdata").text(hackData).html(); // text sanejat, vingui d'on vingui
		$("#hackdata").on("change keyup paste", function() {
			var hackData = this.value;
			GM_setValue("hackData", hackData);
			console.log("hackData (" + hackData.length + " chars) saved");
		});
	}
	if (window.location.pathname == "/group/members.php") {
		var comptadorEstudiants = 0;
		var nomGrup = $("#region-main h3").text().substr(27); // ignora "Afegeix/suprimeix usuaris: "
		var hackData = GM_getValue("hackData").split(/\r?\n/);
		console.log("hackData (" + hackData.length + " lines) read");
		var informacioEstudiantRE = /^.+\s\((\d+), .+\)\s\(\d\)$/;
		$("#addselect option").each(function() {
			var optionEstudiant = $(this);
   			optionEstudiant.prop("selected", false);
			var informacioEstudiant = informacioEstudiantRE.exec(optionEstudiant.text().trim());
			$.each(hackData, function (hackIndex, hackData) {
				if (hackData.indexOf(informacioEstudiant[1]) > -1) { // informacioEstudiant[1] és l'ID de la UdG
		        		hackData = hackData.replace(informacioEstudiant[1], "").trim();
        				if (hackData.indexOf(nomGrup) > -1) { // ATENCIÓ: FALLA SI EL NOM D'UN GRUP ESTÀ INCLÓS A UN ALTRE
        					optionEstudiant.prop("selected", true);
        					comptadorEstudiants++;
		        		}
				}
			});
		});
	}
});
