// ==UserScript==
// @name        Ajudant Grups EPS
// @namespace   http://atc.udg.edu/~bueno/
// @description Millores de l'aplicació web d'assignació de grups a l'EPS de la UdG
// @include     /^https?://pserv\.udg\.edu/.+/((inici|matrProf|configuracio).aspx)?$/
// @require     http://code.jquery.com/jquery-2.1.1.min.js
// @require     http://code.jquery.com/ui/1.11.0/jquery-ui.min.js
// @resource    jQueryUICSS  http://code.jquery.com/ui/1.11.0/themes/redmond/jquery-ui.min.css
// @version     0.4
// @grant       GM_getResourceText
// @grant       GM_addStyle
// @grant       GM_setClipboard
// ==/UserScript==

/* Changelog:
- v0.1 - Llistat únic (tot barrejat) per copiar i enganxar
- v0.2 - Un llistat diferent per a cada assignatura (fent ús de jQuery UI Tabs)
       - Ús forçat d'HTTPS
       - Millores al formulari d'autenticació
       - Compatible amb l'usuari "admin"
- v0.3 - Còpia del llistat d'alumnes al porta-retalls (fent ús de jQuery UI Buttons)
       - Descàrrega del llistat d'alumnes en format CSV (generat al navegador, no al servidor)
       - Compatible amb l'extensió TamperMonkey de Google Chrome
- v0.4 - Taula d'alumnes sempre ordenada alfabèticament
       - Descàrrega del llistat de grups per importar-los al Moodle (generat al navegador)
       - (Només per a "admin") filtrat d'estudiants (fent ús de jQuery UI Autocomplete)
*/

// Redirigeix a la versió segura de la pàgina
if (location.protocol == "http:") {
  location.href = location.href.replace(/^http:/, "https:");
  console.log("AVÍS: Redirigit cap a la versió segura de la pàgina");
}

// Totes les modificacions fan servir jQuery
$(document).ready(function() {
  if ($("#txtBLogin").length) {
    // Millores al formulari d'autenticació: camps obligatoris i cursor de text al primer camp
    $("#txtBLogin").attr("required", "required").focus();
    $("#txtBPassword").attr("required", "required");
  } else if ($("#LLlistatsGrups").length) {
    // Alternativa al selector de grups
    // Pas 1: Habilitar el tema "Redmond" de jQuery UI (sense imatges)
    // Obté el full d'estil associat i omet l"ús d'imatges
    var jQueryUICSS  = GM_getResourceText("jQueryUICSS").replace(/url\(images\/.+?\)/g, "none");
    // Insereix el full d'estil del tema a la pàgina amb algunes regles d'estil addicionals
    GM_addStyle(jQueryUICSS +
        // canvis a jQueryUICSS
        "div.ui-tabs {font-size:80%;margin-top:1em;overflow:auto}" +
        "div.ui-tabs-panel table {font-size:100%}" +
        ".ui-autocomplete {max-height:8em;overflow-x:hidden;overflow-y:auto}" +
        ".ui-widget {font-size:90%}" +
        // CSS pels panels de les assignatures
        "#assignatures table {border:1px solid black;border-collapse:collapse;margin-bottom:1em}" +
        "#assignatures th {border:1px solid black;padding:0.2em 0.4em;background-color:#DFEFFC}" +
        "#assignatures td {border:1px solid black;padding:0.2em 0.4em;background-color:white}" +
        "#assignatures table.grups {float:left;margin-right:1em;background-color:#DDD}" +
        "#assignatures div a {margin:0 1em 1em 0;display:inline-block}" +
        "#assignatures div a.descarregarGrups {float:left;clear:left}" +
        // CSS pel filtre d'estudiants (només per a l'usuari "admin")
        "#filtreEstudiants {padding:0.2em}" +
        "#filtreEstudiants input {width:100%}");
    // Pas 2: Obtenir llistats de grups, tipus de grups i assignatures a partir del selector
    var llistaGrups = [];
    var llistaTipusGrup = [];
    var llistaAssignatures = [];
    var esAdmin = ($("#LDadesPersonals").length === 0);
    var informacioGrupRE = /^([^\.]+)\.\s+([^\.]+)\s+-\s+(Grup\s+[^\s]+)$/;
    $("#LLlistatsGrups option").each(function() {
      // Guarda a informacioGrup el nom de l'assignatura i el tipus, el nom i l'id numèric del grup
      var informacioGrup = informacioGrupRE.exec($(this).text().trim());
      informacioGrup.shift();
      informacioGrup[0] = formatTitol(informacioGrup[0]);
      informacioGrup.push($(this).val());
      // Guarda la informació pertinent a cada llistat (amb repeticions si n'hi ha)
      // AVÍS: Es barrejen els tipus de grups de totes les assignatures (simplificació intencionada)
      llistaGrups.push(informacioGrup.join(";"));
      llistaTipusGrup.push(informacioGrup[1]);
      llistaAssignatures.push(informacioGrup[0]);
    });
    // Ordena els llistats eliminant les repeticions si n'hi ha
    llistaGrups.sort(ordreNatural);
    llistaTipusGrup = llistaTipusGrup.filter(senseRepeticions).sort(ordreNatural);
    llistaAssignatures = llistaAssignatures.filter(senseRepeticions).sort(ordreNatural);
    // Mostra per consola les assignatures i els tipus de grup
    console.log("Assignatures (" + llistaAssignatures.length + "): " + llistaAssignatures.join(", "));
    console.log("Tipus de grup (" + llistaTipusGrup.length + "): " + llistaTipusGrup.join(", "));
    // Pas 3: Crear (amb jQuery UI) una pestanya per assignatura amb el llistat de grups corresponent
    // Un DIV UL fa de contenidor per a l'estructura de pestanyes
    $("#LLlistatsGrups").parents("table.caixa").after('<div id="assignatures"><ul>');
    $.each(llistaAssignatures, function(indexAssignatura, nomAssignatura) {
      var idAssignatura = "assignatura" + indexAssignatura;
      // Cada pestanya serà un LI (l'HREF ha d'apuntar a l'ID del panel associat a la pestanya)
      $("#assignatures ul").append('<li><a href="#' + idAssignatura + '">' + nomAssignatura);
      // Un DIV per a cada assignatura (amb una taula pels grups i un botó per continuar la feina)
      $("#assignatures").append('<div id="' + idAssignatura + '">');
      $("#" + idAssignatura).append('<table class="grups"><thead><tr><tbody>')
          .append('<a href="#" class="compilar">Compilar llistat alumnes')
      $("#" + idAssignatura + " table.grups thead tr").append("<th>Tipus").append("<th>Nom");
    });
    // Emplena la taula de grups de cada pestanya
    $.each(llistaGrups, function(indexGrup, informacioGrup) {
      informacioGrup = informacioGrup.split(";"); // assignatura, tipus grup, nom grup, id grup
      var idAssignatura = "assignatura" + llistaAssignatures.indexOf(informacioGrup[0]);
      var indexTipus = llistaTipusGrup.indexOf(informacioGrup[1]);
      var idGrup = "informacioGrup" + informacioGrup[3];
      $("#" + idAssignatura + " table.grups tbody")
          .append('<tr id="' + idGrup + '" class="tipus' + indexTipus + '">');
      $("#" + idGrup).append("<td>" + informacioGrup[1]).append("<td>" + informacioGrup[2]);
    });
    // Aplica el widget "Tabs" de jQuery UI (http://api.jqueryui.com/tabs/)
    $("#assignatures").tabs({
      // Mostra l'assignatura inicial al títol de la pàgina i a la consola
      create: function(event, ui) {
        var textPestanya = ui.tab[0].textContent;
        $(document).attr("title", (esAdmin) ? "(admin) " + textPestanya : textPestanya);
        console.log("Pestanya inicial: " + textPestanya);
      },
      // Mostra l'assignatura seleccionada al títol de la pàgina i a la consola
      activate: function(event, ui) {
        var textPestanya = ui.newTab[0].textContent;
        $(document).attr("title", (esAdmin) ? "(admin) " + textPestanya : textPestanya);
        console.log("Pestanya seleccionada: " + textPestanya);
      }
    });
    // Pas 4: Compilar el llistat d'alumnes en prémer el botó (un widget "Button" de jQuery UI)
    $("#assignatures a.compilar").button().click(function(event) {
      event.preventDefault();
      var idAssignatura = $(this).parent().attr("id");
      // Afegeix tres nous botons i la taula dels alumnes
      $("#" + idAssignatura)
          .append('<a href="#" class="descarregarGrups">Descarregar grups pel Moodle')
          .append('<a href="#" class="descarregarAlumnes">Descarregar llistat alumnes')
          .append('<a href="#" class="copiarAlumnes">Copiar al porta-retalls')
          .append('<table class="alumnes"><thead><tr><tbody>');
      // Esborra el botó ja utilitzat i (per ara) oculta els nous botons
      $("#" + idAssignatura + " a.compilar").remove();
      $("#" + idAssignatura + " a").hide();
      // Afegeix noves columnes a les dues taules
      $("#" + idAssignatura + " table.grups thead tr").append("<th>Horari").append("<th>Ocupació");
      $("#" + idAssignatura + " table.alumnes thead tr").append("<th>Cognoms").append("<th>Nom")
          .append("<th>Número UdG").append("<th>" + llistaTipusGrup.join("<th>"));
      // L'usuari "admin" fa servir una URL diferent de la dels professors
      var nomScript = (esAdmin) ? "configLlistarGrup.aspx" : "llistarGrup.aspx";
      // Compta quants grups s'han processat
      var grupsProcessats = 0;
      // Processa cada grup
      $("#" + idAssignatura + " table.grups tbody tr").each(function() {
        var indexGrup = $(this).attr("id").substring(14);
        var htmlFragmentRE = /<br[\s\S]+?id="TAlumnes"[\s\S]+?table>/ig;
        $("#Form1").append('<div id="grup' + indexGrup + '">');
        // Descarrega l'HTML de cada llistat i insereix el fragment rellevant com a contingut
        $.get(nomScript + "?GRUP=" + indexGrup, function(html) {
          $("#grup" + indexGrup).hide().html(htmlFragmentRE.exec(html).toString()
              // Preserva la unicitat dels IDs inserits
              .replace(/(LGrup|LHorari|TAlumnes)/ig, "$&" + indexGrup));
          // Obté i formata l'horari del grup (no disponible per l'usuari "admin")
          var horariGrup = $("#LHorari" + indexGrup).text().toLocaleUpperCase()
              .replace(/(\d)[RN].+: (\w+) 0?([\d-]+)(.*)/, "$1Q: $2 $3$4").replace("(SET", " (Setm");
          // Afegeix horari i recompte d'alumnes a la taula dels grups
          var idInformacioGrup = "informacioGrup" + indexGrup;
          $("#" + idInformacioGrup).append("<td>" + (horariGrup || "n/d"))
              .append("<td>" + $("#TAlumnes" + indexGrup + " tr+tr").length);
          // Afegeix els alumnes de cada grup descarregat a la taula d'alumnes
          var indexTipus = llistaTipusGrup.indexOf($("#" + idInformacioGrup + " td:first").text());
          var nomGrup = $("#" + idInformacioGrup + " td:eq(1)").text();
          var taulaAlumnes = $("#" + idAssignatura + " table.alumnes tbody");
          $("#TAlumnes" + indexGrup + " tr+tr").each(function() {
            var contingutFila = $(this).children();
            var numeroUdG = contingutFila.eq(1).text();
            // Si és un alumne no existent a la taula, afegeix totes les seves dades
            var filaAlumne = $("#" + idAssignatura + "_" + numeroUdG);
            if (!filaAlumne.length) {
              filaAlumne = taulaAlumnes.append('<tr id="' + idAssignatura + "_" + numeroUdG + '">');
              var cognoms = formatTitol(contingutFila.eq(2).text());
              var nom = formatTitol(contingutFila.eq(3).text());
              var filaAlumne = $("#" + idAssignatura + "_" + numeroUdG);
              filaAlumne.append("<td>" + cognoms).append("<td>" + nom).append("<td>" + numeroUdG);
              $.each(llistaTipusGrup, function(indexGrup) {
                filaAlumne.append('<td class="tipus' + indexGrup + '">');
              });
            }
            // Apunta que l'alumne està apuntat al grup processat tant si és nou a la taula com si no
            filaAlumne.find("td.tipus" + indexTipus).html(nomGrup);
            // Reordena alfabèticament la taula (és redundant fer-ho amb cada grup però queda bé)
            var llistaAlumnes = textTaula(taulaAlumnes, "\t", "\n").split("\n").sort(ordreNatural);
            $.each(llistaAlumnes, function(index, alumne) {
              var detalls = alumne.split("\t");
              taulaAlumnes.append($("#" + idAssignatura + "_"+detalls[2]));
            });
          });
          grupsProcessats++;
          // Quan s'han processat tots els grups, mostra els nous botons
          if (grupsProcessats == $("#" + idAssignatura + " table.grups tbody tr").length) {
            $("#" + idAssignatura + " a").show();
          }
        });
      });
      // Pas 5A: Descarregar el llistat de grups pel Moodle (UTF-8 sense BOM i separat per comes)
      $("#" + idAssignatura + " a.descarregarGrups").button().click(function(event) {
      	var nomAssignatura = $(document).attr("title");
        var taulaGrups = $("#" + $(this).parent().attr("id") + " table.grups tbody");
				var resultat = "groupname,description\r\n" + textTaula(taulaGrups, ";", "\r\n")
						.replace(/^(.+);(.+);(.+);\d+$/img, "$2,<b>" + nomAssignatura + "</b><br>$1<br>$3");
        $("a.descarregarGrups")
            .attr("href", "data:text/plain;charset=utf-8," + encodeURIComponent(resultat))
            .attr("download", nomAssignatura + " (grups Moodle).txt");
        alert("Es recomanable revisar les descripcions dels grups abans d'importar-los a l'UdGMoodle");
      });
      // Pas 5B: Descarregar el llistat d'alumnes en format CSV
      $("#" + idAssignatura + " a.descarregarAlumnes").button().click(function(event) {
        var taulaAlumnes = $("#" + $(this).parent().attr("id") + " table.alumnes");
        $("a.descarregarAlumnes")
            .attr("href", "data:text/plain;charset=utf-8,"
                + encodeURIComponent("\uFEFF" + textTaula(taulaAlumnes, ";", "\r\n")))
            .attr("download", $(document).attr("title") + ".csv");
      });
      // Pas 5C: Copiar el llistat d'alumnes al porta-retalls
      $("#" + idAssignatura + " a.copiarAlumnes").button().click(function(event) {
        event.preventDefault();
        var taulaAlumnes = $("#" + $(this).parent().attr("id") + " table.alumnes");
        GM_setClipboard(textTaula(taulaAlumnes, "\t", "\r\n"));
        alert("S'ha copiat una llista amb " + (taulaAlumnes.find("tbody tr").length) + " alumnes");
      });
    });
    // Millora del selector d'alumnes (funció extra per a l'usuari "admin")
    if ($("#LMMEstudiants").length) {
      var llistaEstudiants = [];
      $("#LMMEstudiants option").each(function() {
        var informacioEstudiantRE = /^(\d{7}) - (.+), (.+)$/;
        var informacioEstudiant = informacioEstudiantRE.exec($(this).text().trim());
        llistaEstudiants.push(formatTitol(informacioEstudiant[3] + " " + informacioEstudiant[2]) +
            " (" + informacioEstudiant[1] + ")");
      });
      console.log("Usuari admin: " + llistaEstudiants.length + " estudiants trobats al selector");
      $("#LMMEstudiants").closest("tbody")
          .append('<tr><td id="filtreEstudiants">Filtrar estudiants: <input type="text">');
      $("#filtreEstudiants").addClass("ui-widget ui-widget-header ui-corner-all");
      $("#filtreEstudiants input").autocomplete({
      	delay: 0,
        close: function () {
          var estudiantSeleccionat = $("#filtreEstudiants input").val().substr(-8,7);
          $("#LMMEstudiants").val(estudiantSeleccionat);
        },
        source: function(request, response) { // Adaptada de http://jqueryui.com/autocomplete/#folding
          var matcher = new RegExp($.ui.autocomplete.escapeRegex(request.term), "i");
          response($.grep(llistaEstudiants, function(value) {
            return matcher.test(value) || matcher.test(textNormalitzat(value));
          }));
        }
      }).on("focus", function() {
        this.value = "";
      }).on("keypress", function(event) {
        if (event.keyCode == 13) {
          event.preventDefault();
        };
      });
    }
  }
});

// Obté el text d'una taula ordenat alfabèticament, podent indicar els separadors de columna i fila
function textTaula($taula, separadorColumna, separadorFila) {
  var fileres = [];
  $taula.find("tr").each(function() {
    var filera = [];
    $(this).find("th, td").each(function() {
      filera.push($(this).text());
    });
    fileres.push(filera.join(separadorColumna).trim());
  });
  return fileres.join(separadorFila);
}

// Basat en codi trobat a http://snipplr.com/view/36012/javascript-natural-sort/
function ordreNatural(a, b) {
  var a1, b1, rx = /(\d+)|(\D+)/g, rd = /\d+/;
  a = String(a).toLowerCase().match(rx);
  b = String(b).toLowerCase().match(rx);
  while (a.length && b.length) {
    a1 = a.shift();
    b1 = b.shift();
    if (rd.test(a1) || rd.test(b1)) {
      if (!rd.test(a1)) { return 1; }
      if (!rd.test(b1)) { return -1; }
      if (a1 !== b1) { return a1 - b1; }
    }
    else if (a1 !== b1) { return a1.localeCompare(b1); }
  }
  return a.length - b.length;
}

// Codi trobat a http://stackoverflow.com/a/14438954
function senseRepeticions(value, index, self) {
  return self.indexOf(value) === index;
}

// Posa només la primera lletra de cada paraula en majúscules
function formatTitol(text) {
  // Inicialment totes les paraules es posen amb la primera lletra majúscula i la resta minúscules
  return text.replace(/([dl]\'|\.|-)?(\S)([^\s\.-]*)/gi, function($0, $1, $2, $3) {
    // Una primera excepció són les contraccions de preposicions i articles, que van en minúscules
    // NOTA 1: El que hi ha al voltant de $1 és perquè Chrome retorna un undefined en lloc d'un ""
    return ($1||"").toLocaleLowerCase() + $2.toLocaleUpperCase() + $3.toLocaleLowerCase();
  // El segon conjunt d'excepcions: conjuncions, preposicions i articles (s'omet "El" intencionadament)
  // NOTA 2: El cas de l'article "El" és ambigu: també pot ser part de cognoms com "Ahsen El Kassem"
  // Afortunadament per a aquest script l'article no es fa servir en cap nom d'assignatura
  }).replace(/(\s(A|Al|Als|De|Del|Els|En|I|La|Les))+\s/g, function($0) {
    return $0.toLocaleLowerCase();
  // Una altra excepció són els nombres romans (per simplicitat, només petits i a final de línia)
  }).replace(/\s[IVX][ivx]*$/g, function($0) {
    return $0.toLocaleUpperCase();
  // I algunes excepcions menors finals:
  //   - cognoms no compostos però amb guionets
  //   - eles mal geminades
  //   - guionets amb espais innecessaris a cognoms compostos
  }).replace("Vall-Ll", "Vall-ll").replace("l.L", "l·l").replace(" - ", "-");
}

// Adaptada de http://jqueryui.com/autocomplete/#folding
function textNormalitzat(text) {
  var mapaAccents = {"á":"a", "à":"a", "ã":"a", "é":"e", "è":"e", "í":"i", "ï":"i", "ó":"o", "ò":"o",
  	  "ú":"u", "ü":"u", "·":"."};
  var resultat = "";
  text = text.toLocaleLowerCase();
  for (var i = 0; i < text.length; i++) {
    resultat += mapaAccents[text.charAt(i)] || text.charAt(i);
  }
  return resultat;
};
