// Crear el mapa centrado en Colombia.
const map = L.map("map").setView([4.5709, -74.2973], 6);

const fuenteDANE =
  "DANE — Departamento Administrativo Nacional de Estadística";

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

// Mantener los municipios debajo de los departamentos interactivos.
map.createPane("municipios");
map.getPane("municipios").style.zIndex = 390;

// Control para activar y desactivar las capas.
const controlCapas = L.control.layers(
  {
    "OpenStreetMap": osm
  },
  {},
  {
    collapsed: true
  }
).addTo(map);

let departamentosGeoJSON;
let municipiosGeoJSON;
let estadoDepartamentos = "Cargando departamentos…";

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
    : estadoDepartamentos;

  this.contenedor.append(titulo, detalle);
};

info.addTo(map);

// Leyenda independiente de GeoServer.
const leyenda = L.control({ position: "bottomright" });

leyenda.onAdd = function () {
  this.contenedor = L.DomUtil.create("div", "info legend");

  L.DomEvent.disableClickPropagation(this.contenedor);

  this.update();
  return this.contenedor;
};

leyenda.update = function () {
  this.contenedor.replaceChildren();

  const titulo = document.createElement("h4");
  titulo.textContent = "Leyenda";
  this.contenedor.append(titulo);

  const agregarFila = (texto, color) => {
    const fila = document.createElement("div");
    fila.className = "legend-row";
    fila.style.display = "flex";
    fila.style.alignItems = "center";
    fila.style.gap = "8px";
    fila.style.marginBottom = "6px";

    const simbolo = document.createElement("span");
    simbolo.style.display = "inline-block";
    simbolo.style.width = "24px";
    simbolo.style.flexShrink = "0";
    simbolo.style.borderTop = "2px solid " + color;

    const etiqueta = document.createElement("span");
    etiqueta.textContent = texto;

    fila.append(simbolo, etiqueta);
    this.contenedor.append(fila);
  };

  if (
    departamentosGeoJSON &&
    map.hasLayer(departamentosGeoJSON)
  ) {
    agregarFila("Departamentos (GeoJSON)", "#145da0");
    agregarFila("Departamento resaltado", "#ff7800");
  }

  if (
    municipiosGeoJSON &&
    map.hasLayer(municipiosGeoJSON)
  ) {
    agregarFila("Municipios (GeoJSON)", "#319b48");
  }

  const fuente = document.createElement("div");
  fuente.textContent = "Fuente: DANE";
  fuente.style.fontSize = "11px";
  fuente.style.marginTop = "6px";

  this.contenedor.append(fuente);
};

leyenda.addTo(map);

// Actualizar la leyenda al activar o desactivar capas.
map.on("overlayadd overlayremove", function () {
  leyenda.update();

  if (
    departamentosGeoJSON &&
    !map.hasLayer(departamentosGeoJSON)
  ) {
    info.update();
  }
});

// Leer y comprobar un archivo GeoJSON.
async function leerGeoJSON(ruta) {
  const respuesta = await fetch(ruta);

  if (!respuesta.ok) {
    throw new Error(
      "No se pudo cargar " + ruta +
      ". Error HTTP: " + respuesta.status
    );
  }

  const datos = await respuesta.json();

  if (
    datos.type !== "FeatureCollection" ||
    !Array.isArray(datos.features) ||
    datos.features.length === 0
  ) {
    throw new Error(
      "El archivo " + ruta + " no contiene entidades válidas."
    );
  }

  return datos;
}

// Cargar todos los departamentos de Colombia.
leerGeoJSON("datos/departamentos.geojson")
  .then(function (datos) {
    departamentosGeoJSON = L.geoJSON(datos, {
      attribution: fuenteDANE,

      style: {
        color: "#145da0",
        weight: 1,
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
          "Código: " +
          (propiedades.dpto_ccdgo ?? "No disponible");

        contenido.append(nombre, codigo);
        layer.bindPopup(contenido);

        // Resaltar al pasar el cursor.
        layer.on("mouseover", function () {
          info.update(propiedades);

          layer.setStyle({
            color: "#ff7800",
            weight: 2,
            fillOpacity: 0.35
          });
        });

        // Recuperar el estilo al retirar el cursor.
        layer.on("mouseout", function () {
          departamentosGeoJSON.resetStyle(layer);
          info.update();
        });
      }
    });

    departamentosGeoJSON.addTo(map);

    controlCapas.addOverlay(
      departamentosGeoJSON,
      "Departamentos (GeoJSON)"
    );

    estadoDepartamentos =
      "Pasa el cursor sobre un departamento.";

    info.update();
    leyenda.update();
  })
  .catch(function (error) {
    console.error("Error cargando departamentos:", error);

    estadoDepartamentos =
      "No se pudieron cargar los departamentos. " +
      "Revisa el archivo datos/departamentos.geojson.";

    info.update();
  });

// Cargar todos los municipios de Colombia.
// Se muestran únicamente al activarlos en el control de capas.
leerGeoJSON("datos/municipios.geojson")
  .then(function (datos) {
    municipiosGeoJSON = L.geoJSON(datos, {
      attribution: fuenteDANE,
      pane: "municipios",
      interactive: false,

      style: {
        color: "#319b48",
        weight: 1,
        opacity: 0.85,
        fill: false
      }
    });

    controlCapas.addOverlay(
      municipiosGeoJSON,
      "Municipios (GeoJSON)"
    );

    leyenda.update();
  })
  .catch(function (error) {
    console.error("Error cargando municipios:", error);

    alert(
      "No se pudieron cargar los municipios. " +
      "Revisa el archivo datos/municipios.geojson."
    );
  });