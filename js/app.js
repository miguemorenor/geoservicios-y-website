// Crear el mapa centrado en Colombia.
const map = L.map("map").setView([4.5709, -74.2973], 6);

// Agregar el mapa base de OpenStreetMap.
const osm = L.tileLayer(
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }
).addTo(map);

// Mostrar una escala en metros y kilómetros.
L.control.scale({
  metric: true,
  imperial: false
}).addTo(map);

// Dirección del servicio WMS de nuestro GeoServer.
const geoserverUrl = "http://localhost:8080/geoserver/curso/wms";

// Departamentos: visibles al iniciar.
const departamentosWMS = L.tileLayer.wms(geoserverUrl, {
  layers: "curso:departamentos",
  format: "image/png",
  transparent: true,
  version: "1.1.1"
}).addTo(map);

// Municipios: se activan desde el control de capas.
const municipiosWMS = L.tileLayer.wms(geoserverUrl, {
  layers: "curso:municipios",
  format: "image/png",
  transparent: true,
  version: "1.1.1"
});

// Control para activar y desactivar las capas.
const controlCapas = L.control.layers(
  {
    "OpenStreetMap": osm
  },
  {
    "Departamentos (WMS)": departamentosWMS,
    "Municipios (WMS)": municipiosWMS
  },
  {
    collapsed: true
  }
).addTo(map);

// Cargar departamentos con geometrías y atributos desde WFS.
const wfsUrl =
  "http://localhost:8080/geoserver/curso/wfs" +
  "?service=WFS&version=2.0.0&request=GetFeature" +
  "&typeNames=curso:departamentos" +
  "&outputFormat=application/json&srsName=EPSG:4326";

fetch(wfsUrl)
  .then(function (respuesta) {
    if (!respuesta.ok) {
      throw new Error("Error HTTP: " + respuesta.status);
    }

    return respuesta.json();
  })
  .then(function (datos) {
    const departamentosGeoJSON = L.geoJSON(datos, {
      style: {
        color: "#145da0",
        weight: 2,
        fillColor: "#8cc8ff",
        fillOpacity: 0.15
      },

      onEachFeature: function (feature, layer) {
        const propiedades = feature.properties || {};

        const contenido = document.createElement("div");

        const nombre = document.createElement("strong");
        nombre.textContent =
          propiedades.dpto_cnmbr ?? "Nombre no disponible";

        const codigo = document.createElement("div");
        codigo.textContent =
          "Código: " + (propiedades.dpto_ccdgo ?? "No disponible");

        contenido.append(nombre, codigo);
        layer.bindPopup(contenido);

        // Resaltar al pasar el cursor.
        layer.on("mouseover", function () {
            info.update(propiedades);

          layer.setStyle({
            color: "#ff7800",
            weight: 4,
            fillOpacity: 0.35
          });
        });

        // Recuperar el estilo al retirar el cursor.
        layer.on("mouseout", function () {
          departamentosGeoJSON.resetStyle(layer);
          info.update();
        });
      }
    }).addTo(map);

    controlCapas.addOverlay(
      departamentosGeoJSON,
      "Departamentos (WFS interactivo)"
    );
  })
  .catch(function (error) {
    console.error("Error cargando WFS:", error);
    alert("No se pudo cargar WFS. Revisaremos la consola del navegador.");
  });

  // Panel de información.
const info = L.control({ position: "topleft" });

info.onAdd = function () {
  this.contenedor = L.DomUtil.create("div", "info");
  L.DomEvent.disableClickPropagation(this.contenedor);
  this.update();
  return this.contenedor;
};

info.update = function (propiedades) {
  this.contenedor.replaceChildren();

  const titulo = document.createElement("h4");
  titulo.textContent = "Departamentos de Colombia";

  const detalle = document.createElement("div");
  detalle.textContent = propiedades
    ? `${propiedades.dpto_cnmbr ?? "Sin nombre"} · Código: ${
        propiedades.dpto_ccdgo ?? "No disponible"
      }`
    : "Pasa el cursor sobre un departamento.";

  this.contenedor.append(titulo, detalle);
};

info.addTo(map);

// Leyenda del mapa.
const leyenda = L.control({ position: "bottomright" });

leyenda.onAdd = function () {
  const div = L.DomUtil.create("div", "info legend");

  div.innerHTML = `
    <h4>Leyenda</h4>

    <div class="legend-row">
      <span class="legend-line" style="border-color: #145da0"></span>
      Departamentos WFS
    </div>

    <div class="legend-row">
      <span class="legend-line" style="border-color: #ff7800"></span>
      Departamento resaltado
    </div>

    <div id="leyenda-departamentos-wms">
      <strong>Departamentos WMS</strong>
    </div>

    <div id="leyenda-municipios-wms">
      <strong>Municipios WMS</strong>
    </div>
  `;

  // Obtener la simbología real de GeoServer.
  function agregarImagen(contenedor, nombreCapa) {
    const imagen = document.createElement("img");

    imagen.src = geoserverUrl +
      "?service=WMS&version=1.1.1" +
      "&request=GetLegendGraphic&format=image/png" +
      "&layer=curso:" + nombreCapa;

    imagen.alt = "Simbología de " + nombreCapa;
    contenedor.append(imagen);
  }

  const departamentos = div.querySelector("#leyenda-departamentos-wms");
  const municipios = div.querySelector("#leyenda-municipios-wms");

  agregarImagen(departamentos, "departamentos");
  agregarImagen(municipios, "municipios");

  function actualizar() {
    departamentos.hidden = !map.hasLayer(departamentosWMS);
    municipios.hidden = !map.hasLayer(municipiosWMS);

    let wfsActivo = false;

    map.eachLayer(function (capa) {
      if (capa instanceof L.GeoJSON) {
        wfsActivo = true;
      }
    });

    div.querySelectorAll(".legend-row").forEach(function (fila) {
      fila.style.display = wfsActivo ? "flex" : "none";
    });
  }

 map.on("layeradd layerremove overlayadd overlayremove", actualizar);
  actualizar();

  L.DomEvent.disableClickPropagation(div);
  return div;
};

leyenda.addTo(map);