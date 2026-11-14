// Crear el mapa centrado en el Huila.
const map = L.map("map", {
  maxBoundsViscosity: 1.0
}).setView([2.5359, -75.5277], 8);

// Mapa base.
const osm = L.tileLayer(
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }
).addTo(map);

// Escala.
L.control.scale({
  metric: true,
  imperial: false
}).addTo(map);

// Servicios de nuestro GeoServer local.
const geoserverUrl =
  "http://localhost:8080/geoserver/curso/wms";

const filtroHuila = "dpto_ccdgo = '41'";

// Mostrar únicamente el Huila en WMS.
const departamentosWMS = L.tileLayer.wms(geoserverUrl, {
  layers: "curso:departamentos",
  format: "image/png",
  transparent: true,
  version: "1.1.1",
  CQL_FILTER: filtroHuila,
  attribution: "DANE — Departamento Administrativo Nacional de Estadística"
}).addTo(map);

// Municipios del Huila.
// Esta capa debe tener el campo dpto_ccdgo.
const municipiosWMS = L.tileLayer.wms(geoserverUrl, {
  layers: "curso:municipios",
  format: "image/png",
  transparent: true,
  version: "1.1.1",
  CQL_FILTER: filtroHuila,
  attribution: "DANE — Departamento Administrativo Nacional de Estadística"
});

// Control de capas.
const controlCapas = L.control.layers(
  {
    "OpenStreetMap": osm
  },
  {
    "Huila (WMS)": departamentosWMS,
    "Municipios del Huila (WMS)": municipiosWMS
  },
  {
    collapsed: true
  }
).addTo(map);

let departamentosGeoJSON;
let envolventeHuila;

// Panel de información.
const info = L.control({
  position: "topleft"
});

info.onAdd = function () {
  this.contenedor = L.DomUtil.create("div", "info");
  L.DomEvent.disableClickPropagation(this.contenedor);
  this.update();
  return this.contenedor;
};

info.update = function (propiedades) {
  this.contenedor.replaceChildren();

  const titulo = document.createElement("h4");
  titulo.textContent = "Departamento del Huila";

  const detalle = document.createElement("div");

  detalle.textContent = propiedades
    ? `${propiedades.dpto_cnmbr ?? "Huila"} · Código: ${
        propiedades.dpto_ccdgo ?? "41"
      }`
    : "Pasa el cursor sobre el Huila.";

  this.contenedor.append(titulo, detalle);
};

info.addTo(map);

// Leyenda.
const leyenda = L.control({
  position: "bottomright"
});

leyenda.onAdd = function () {
  const div = L.DomUtil.create("div", "info legend");

  div.innerHTML = `
    <h4>Leyenda</h4>

    <div class="legend-row">
      <span class="legend-line"
            style="border-color: #145da0"></span>
      Huila WFS
    </div>

    <div class="legend-row">
      <span class="legend-line"
            style="border-color: #ff7800"></span>
      Huila resaltado
    </div>

    <div id="leyenda-envolvente">
      <span style="
        display: inline-block;
        width: 20px;
        border-top: 2px dashed #d32f2f;
        margin-right: 6px;
      "></span>
      Envolvente del Huila
    </div>

    <div id="leyenda-departamentos-wms">
      <strong>Huila WMS</strong>
    </div>

    <div id="leyenda-municipios-wms">
      <strong>Municipios del Huila WMS</strong>
    </div>
  `;

  // Obtener la simbología de GeoServer.
  function agregarImagen(contenedor, nombreCapa) {
    const imagen = document.createElement("img");

    imagen.src =
      geoserverUrl +
      "?service=WMS&version=1.1.1" +
      "&request=GetLegendGraphic&format=image/png" +
      "&layer=curso:" + nombreCapa;

    imagen.alt = "Simbología de " + nombreCapa;
    contenedor.append(imagen);
  }

  const departamentos = div.querySelector(
    "#leyenda-departamentos-wms"
  );

  const municipios = div.querySelector(
    "#leyenda-municipios-wms"
  );

  const envolvente = div.querySelector(
    "#leyenda-envolvente"
  );

  agregarImagen(departamentos, "departamentos");
  agregarImagen(municipios, "municipios");

  this.actualizar = function () {
    departamentos.hidden = !map.hasLayer(departamentosWMS);
    municipios.hidden = !map.hasLayer(municipiosWMS);

    const wfsActivo =
      departamentosGeoJSON &&
      map.hasLayer(departamentosGeoJSON);

    div.querySelectorAll(".legend-row").forEach(function (fila) {
      fila.style.display = wfsActivo ? "flex" : "none";
    });

    envolvente.hidden = !(
      envolventeHuila && map.hasLayer(envolventeHuila)
    );
  };

  map.on(
    "layeradd layerremove overlayadd overlayremove",
    this.actualizar
  );

  this.actualizar();

  L.DomEvent.disableClickPropagation(div);
  return div;
};

leyenda.addTo(map);

// Consultar únicamente el Huila mediante WFS.
const wfsUrl =
  "http://localhost:8080/geoserver/curso/wfs" +
  "?service=WFS&version=2.0.0&request=GetFeature" +
  "&typeNames=curso:departamentos" +
  "&outputFormat=application/json" +
  "&srsName=EPSG:4326" +
  "&CQL_FILTER=" + encodeURIComponent(filtroHuila);

fetch(wfsUrl)
  .then(function (respuesta) {
    if (!respuesta.ok) {
      throw new Error("Error HTTP: " + respuesta.status);
    }

    return respuesta.json();
  })
  .then(function (datos) {
    departamentosGeoJSON = L.geoJSON(datos, {
      attribution:
        "DANE — Departamento Administrativo Nacional de Estadística",

      // Comprobar también el código en el navegador.
      filter: function (feature) {
        return String(feature.properties?.dpto_ccdgo) === "41";
      },

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
          propiedades.dpto_cnmbr ?? "Huila";

        const codigo = document.createElement("div");
        codigo.textContent =
          "Código: " + (propiedades.dpto_ccdgo ?? "41");

        contenido.append(nombre, codigo);
        layer.bindPopup(contenido);

        // Resaltar al pasar el cursor.
        layer.on("mouseover", function () {
          info.update(propiedades);

          layer.setStyle({
            color: "#ff7800",
            weight: 3,
            fillOpacity: 0.35
          });
        });

        // Recuperar el estilo.
        layer.on("mouseout", function () {
          departamentosGeoJSON.resetStyle(layer);
          info.update();
        });

        // Acercar al hacer clic.
        layer.on("click", function () {
          map.fitBounds(layer.getBounds());
        });
      }
    });

    const huilaBounds = departamentosGeoJSON.getBounds();

    if (!huilaBounds.isValid()) {
      throw new Error(
        "El servicio WFS no devolvió el Huila. " +
        "Comprueba el campo dpto_ccdgo y el código 41."
      );
    }

    departamentosGeoJSON.addTo(map);

    controlCapas.addOverlay(
      departamentosGeoJSON,
      "Huila (WFS interactivo)"
    );

    // Dibujar la envolvente rectangular.
    envolventeHuila = L.rectangle(huilaBounds, {
      color: "#d32f2f",
      weight: 2,
      dashArray: "8, 6",
      fill: false,
      interactive: false
    }).addTo(map);

    controlCapas.addOverlay(
      envolventeHuila,
      "Envolvente del Huila"
    );

    // Centrar y limitar la navegación.
    const limiteHuila = huilaBounds.pad(0.10);

    map.fitBounds(limiteHuila);
    map.setMaxBounds(limiteHuila);
    map.setMinZoom(map.getZoom());

    leyenda.actualizar();
  })
  .catch(function (error) {
    console.error("Error cargando el Huila:", error);

    alert(
      "No se pudo cargar el Huila desde GeoServer. " +
      error.message
    );
  });
