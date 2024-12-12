var BirdCount =
  BirdCount ||
  (function () {
    var $ = jQuery
      REVIEWED_PATTERN = ["yes", "y", "reviewed"],
      infoBoxTemplate = _.template(
        "<span><b><%=clusterName%></b></span>" +
          "<%if (site && !_.isEmpty(site.trim())){%><br/><b>Site</b>: <%=site%><%}%>" +
          "<%if (owner && !_.isEmpty(owner.trim())){%><br/><b>Owner</b>: <%=owner%><%}%>" +
          '<%if (!_.isEmpty(listUrl["1"])){%><br/><a target="_blank" href="<%=listUrl["1"]%>">List1</a><%}%>' +
          '<%if (!_.isEmpty(listUrl["2"])){%> <a target="_blank" href="<%=listUrl["2"]%>">List2</a><%}%>' +
          '<%if (!_.isEmpty(listUrl["3"])){%> <a target="_blank" href="<%=listUrl["3"]%>">List3</a><%}%>' +
          '<%if (!_.isEmpty(listUrl["4"])){%> <a target="_blank" href="<%=listUrl["4"]%>">List4</a><%}%>'
      ),
      kmlDescription = _.template(
        "<%if (owner && !_.isEmpty(owner.trim())){%><b>Owner</b>: <%=owner%><%}%>" +
          '<%if (!_.isEmpty(listUrl["1"])){%><br/><a target="_blank" href="<%=listUrl["1"]%>">List1</a><%}%>' +
          '<%if (!_.isEmpty(listUrl["2"])){%><br/><a target="_blank" href="<%=listUrl["2"]%>">List2</a><%}%>' +
          '<%if (!_.isEmpty(listUrl["3"])){%><br/><a target="_blank" href="<%=listUrl["3"]%>">List3</a><%}%>' +
          '<%if (!_.isEmpty(listUrl["4"])){%><br/><a target="_blank" href="<%=listUrl["4"]%>">List4</a><%}%>'
      ),
      customMapControlTemplate = _.template(
        '<div class="settings-dropdown dropdown"> \
            <button class="btn btn-default dropdown-toggle" type="button" data-toggle="dropdown"> \
              <span class="glyphicon glyphicon-menu-hamburger"></span></button> \
            <ul class="dropdown-menu dropdown-menu-right"> \
              <li><button type="button" class="btn btn-sm exportKmlBtn" title="Export"><span class="glyphicon glyphicon-download-alt"></span></button> \
                  <%if (locationAvailable){%><button type="button" class="btn btn-sm gotoCurrentLocation" title="Go to Current Location"><span class="glyphicon glyphicon-record"></span></button><%}%> \
                  <button type="button" class="btn btn-sm districtCenter" title="Re-Centre"><span class="glyphicon glyphicon-flag"></span></button> \
              </li> \
              <%if (locationAvailable){%><li><label><input type="checkbox" class="locationChkBox"/> Show Location</label></li><%}%> \
              <li><label><input type="checkbox" class="clusterChkBox"/> Show Clusters</label></li> \
            </ul> \
          </div>'
      ),
      NS_KML = "http://www.opengis.net/kml/2.2",
      NS_GX = "http://www.google.com/kml/ext/2.2",
      RectangleInfo = function (options) {
        this.options = _.extend(
          {
            subCell: null,
            bounds: null,
            clusterName: null,
            site: null,
            owner: null,
            listUrl: {},
            reviewed: "no",
            status: 0,
          },
          options
        );
      },
      BirdMap = function (options) {
        this.options = _.extend(
          {
            zoom: 12,
            mapContainerId: "map-canvas",
            mapSpreadSheetId: null,
            name: "visualization",
          },
          options
        );

        if (!this.options.mapSpreadSheetId) {
          throw "the option 'mapSpreadSheetId' is mandatory";
        }
      };

    RectangleInfo.prototype = {
      setValue: function (name, value) {
        this.options[name] = value;
      },

      getValue: function (name) {
        return this.options[name];
      },

      isReviewed: function () {
        return this.getValue("reviewed")
          ? _.indexOf(
              REVIEWED_PATTERN,
              this.getValue("reviewed").toLowerCase()
            ) >= 0
          : false;
      },

      getFillColor: function () {
        if (this.isReviewed()) {
          return "#660d94";
        }

        switch (this.getValue("status")) {
          case "1":
            return "#B0B0B0";
          case "2":
            return "#808080";
          case "3":
            return "#505050";
          case "4":
            return "#202020";
          default:
            return "#FF8040";
        }
      },

      getFillOpacity: function () {
        return "0.60";
      },
    };

    BirdMap.prototype = {
      options: null,
      map: null,
      center: null,
      rectangleInfos: {},
      showCluster: false,
      clusterPolygons: null,
      labels: [],
      infoBox: new google.maps.InfoWindow(),
      customMapControls: null,
      geoLocation: new GeoLocationMarker.GeoLocationMarker(),

      //checked
      render: function () {
        var sheetData = {},
          drawMapAfter = _.after(3, _.bind(this.drawMap, this, sheetData));

        $.ajax({
          url: this.getMapDataUrl("Coordinates"),
          jsonp: "callback",
          dataType: "jsonp",
          context: this,
          success: function (response) {
            console.log("Coordinates response:", response);
            if (!/^Coordinates/.test(response)) {
              if (this.options.alert) {
                this.options.alert();
              }
            }
            sheetData["coordinates"] = this._parseRowsCoordinates(
              response.values
            );
            drawMapAfter();
          },
          error: function (jqXHR, textStatus, errorThrown) {
            console.error("Coordinates request failed:", textStatus, errorThrown);
          }
        });

        $.ajax({
          url: this.getMapDataUrl("birds lists"),
          jsonp: "callback",
          dataType: "jsonp",
          context: this,
          success: function (response) {
            console.log("Birds lists response:", response);
            if (!/^Birds/.test(response)) {
              if (this.options.alert) {
                this.options.alert();
              }
            }
            sheetData["status"] = this._parseRows(response.values);
            drawMapAfter();
          },
          error: function (jqXHR, textStatus, errorThrown) {
            console.error("Birds lists request failed:", textStatus, errorThrown);
          }
        });

        $.ajax({
          url: this.getMapDataUrl("planning"),
          jsonp: "callback",
          dataType: "jsonp",
          context: this,
          success: function (response) {
            console.log("Planning response:", response);
            if (!/^Planning/.test(response)) {
              if (this.options.alert) {
                this.options.alert();
              }
            }
            sheetData["planning"] = this._parseRows(response.values);
            drawMapAfter();
          },
          error: function (jqXHR, textStatus, errorThrown) {
            console.error("Planning request failed:", textStatus, errorThrown);
          }
        });
      },

      //checked
      drawMap: function (sheetData) {
        console.log("Drawing map with sheetData:", sheetData);
        this.processCoordinates(sheetData["coordinates"]);
        this.processStatusData(sheetData["status"]);
        this.processPlanningData(sheetData["planning"]);
      },

      //checked
      recenter: function () {
        if (this.map) {
          google.maps.event.trigger(this.map, "resize");
          this.map.setCenter(this.center);
        }
      },

      //checked
      processCoordinates: function (rows) {
        console.log("Processing coordinates:", rows);
        this.map = this._createMap(rows);
        this.rectangleInfos = this._createRectangleInfo(rows);
        console.log("this.rectangleInfos:", this.rectangleInfos);
        google.maps.event.addListenerOnce(
          this.map,
          "idle",
          _.bind(function () {
            $("#" + this.options.mapContainerId).removeClass("spinner");
          }, this)
        );
      },

      //nochange checked
      createClusterBoundaries: function () {
        return _.chain(this.rectangleInfos)
          .filter(function (rectangleInfo) {
            return rectangleInfo.getValue("clusterName") != "F";
          })
          .groupBy(function (rectangleInfo) {
            return rectangleInfo.getValue("clusterName");
          })
          .map(function (rectanglesInCluster, clusterName) {
            var latLongs = [];
            _.each(rectanglesInCluster, function (rectangle) {
              var bounds = rectangle.getValue("bounds"),
                ne = bounds.getNorthEast(),
                sw = bounds.getSouthWest(),
                nw = new google.maps.LatLng(ne.lat(), sw.lng()),
                se = new google.maps.LatLng(sw.lat(), ne.lng());
              latLongs.push(sw, nw, se, ne);
            });
            return {
              clusterName: clusterName,
              polygon: new google.maps.Polygon({
                map: this.map,
                paths: this.convexHull(latLongs),
                fillColor: "#FF0000",
                strokeWeight: 2,
                fillOpacity: 0.3,
                strokeColor: "#0000FF",
                strokeOpacity: 0.3,
                zIndex: -1000,
                clickable: false,
              }),
            };
          }, this)
          .value();
      },

      //checked
      _createMap: function (rows) {
        var bounds = new google.maps.LatLngBounds();

        _(rows).each(function (row) {
          const latitudeCB = parseFloat(row["Latitude_C"]);
          const longitudeCB = parseFloat(row["Longitude_B"]);
          const latitudeGF = parseFloat(row["Latitude_G"]);
          const longitudeGF = parseFloat(row["Longitude_F"]);

          if (!isNaN(latitudeCB) && !isNaN(longitudeCB))
            bounds.extend(new google.maps.LatLng(latitudeCB, longitudeCB));
          if (!isNaN(latitudeGF) && !isNaN(longitudeGF))
            bounds.extend(new google.maps.LatLng(latitudeGF, longitudeGF));
        });

        this.center = bounds.getCenter();

        return new google.maps.Map(
          document.getElementById(this.options.mapContainerId),
          {
            zoom: this.options.zoom,
            center: this.center,
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            mapId: "f1b7b3b3b3b3b3b3",
          }
        );
      },

      //checked
      _createRectangleInfo: function (rows) {
        var ret = {};
        _(rows).each(function (row) {
          const lat1 = row["Latitude_C"];
          const lng1 = row["Longitude_B"];
          const lat2 = row["Latitude_G"];
          const lng2 = row["Longitude_F"];

          ret[row.Subcell_ID] = new RectangleInfo({
            bounds: new google.maps.LatLngBounds(
              new google.maps.LatLng(lat1, lng1),
              new google.maps.LatLng(lat2, lng2)
            ),
            subCell: row.Subcell_ID,
          });
        });
        return ret;
      },

      //checked
      processStatusData: function (rows) {
        _(rows).each(function (row) {
          var rectangleInfo = this.rectangleInfos[row["Sub-cell"]];
          if (rectangleInfo) {
            rectangleInfo.setValue("reviewed", row["Reviewed"]);
            rectangleInfo.setValue("status", row["Count"]);
            
            rectangleInfo.setValue("listUrl", {
              1: this._fixPartialBirdListURL(row["List 1"]),
              2: this._fixPartialBirdListURL(row["List 2"]),
              3: this._fixPartialBirdListURL(row["List 3"]),
              4: this._fixPartialBirdListURL(row["List 4"]),
            });
          }
        }, this);
        
        console.log("Processing status data:");
        this._drawCoverageInfo();
      },

      //checked
      processPlanningData: function (rows) {
        console.log("Processing planning data:", rows);
        rows = _(rows).filter(function (row) {
          return row;
        });
        _(rows).each(function (row) {
          var rectangleInfo = this.rectangleInfos[row["Subcell_ID"]];
          if (rectangleInfo) {
            rectangleInfo.setValue("clusterName", row["Cluster"]);
            rectangleInfo.setValue("owner", row["Owner"]);
            rectangleInfo.setValue("site", row["Village/Site Name"]);
          }
        }, this);
      },
      
      //nochange checked
      _fixPartialBirdListURL: function (url) {
        if (!url) {
          return "";
        }
        url = url.trim();
        if (_.isEmpty(url)) {
          return "";
        }
        return /^http/.test(url)
          ? url
          : "http://ebird.org/ebird/view/checklist?subID=" + url;
      },

      //nochange checked
      _drawCoverageInfo: function () {
        console.log("Drawing coverage info");
        _(this.rectangleInfos).each(function (rectangleInfo) {
          var rectangle = new google.maps.Rectangle({
              strokeColor: rectangleInfo.getFillColor(),
              strokeOpacity: 0.8,
              strokeWeight: 10,
              fillColor: rectangleInfo.getFillColor(),
              fillOpacity: rectangleInfo.getFillOpacity(),
              map: this.map,
              bounds: rectangleInfo.getValue("bounds"),
            }),
            label = new InfoBox({
              content: rectangleInfo.getValue("subCell"),
              boxStyle: {
                textAlign: "center",
                fontSize: "7pt",
                width: "60px",
              },
              disableAutoPan: true,
              pixelOffset: new google.maps.Size(-30, -5),
              position: rectangleInfo.getValue("bounds").getCenter(),
              closeBoxURL: "",
              isHidden: false,
              enableEventPropagation: true,
            });

          this.labels.push(label);
          google.maps.event.addListener(
            rectangle,
            "click",
            _.bind(this._showInfoWindow, this, rectangleInfo)
          );
        }, this);
        this._showHideLabels();
        google.maps.event.addListener(
          this.map,
          "zoom_changed",
          _.bind(this._showHideLabels, this)
        );
        this._createCustomControls();
      },

      //nochange checked
      _showInfoWindow: function (rectangleInfo) {
        var content = infoBoxTemplate(rectangleInfo.options);
        this.infoBox.setContent(content);
        this.infoBox.setPosition(rectangleInfo.getValue("bounds").getCenter());
        this.infoBox.open(this.map);
      },

      //nochange checked
      _showHideLabels: function () {
        var showLabel = this.map.getZoom() > 10;
        _(this.labels).each(function (label) {
          label.setMap(showLabel ? this.map : null);
        }, this);
      },

      //nochange checked
      gotoCurrentLocation: function () {
        this.customMapControls.find(".locationChkBox").prop("checked", true);
        this.geoLocation.setMap(this.map);
        this.geoLocation.panMapToCurrentPosition();
      },

      //nochange checked
      showLocation: function (e) {
        if (e.target.checked) {
          this.geoLocation.setMap(this.map);
          this.geoLocation.panMapToCurrentPosition();
        } else {
          this.geoLocation.setMap(null);
        }
      },

      //nochange checked
      _recenterToDistrict: function () {
        this.map.panTo(this.center);
      },

      //nochange checked
      clusterCheckboxClicked: function (e) {
        this.showCluster = e.target.checked;
        if (this.showCluster) {
          if (!this.clusterPolygons) {
            this.clusterPolygons = this.createClusterBoundaries();
          } else {
            _.each(
              this.clusterPolygons,
              function (clusterPolygon) {
                clusterPolygon.polygon.setMap(this.map);
              },
              this
            );
          }
        } else {
          _.each(this.clusterPolygons, function (clusterPolygon) {
            clusterPolygon.polygon.setMap(null);
          });
        }
      },

      //nochange checked
      _createCustomControls: function () {
        this.customMapControls = $(
          customMapControlTemplate({
            locationAvailable: this.geoLocation.isLocationAvailable(),
          })
        );
        this.customMapControls 
          .find(".exportKmlBtn")
          .bind("click", _.bind(this._exportKml, this));
        this.customMapControls
          .find(".districtCenter")
          .bind("click", _.bind(this._recenterToDistrict, this));
        this.customMapControls
          .find(".clusterChkBox")
          .bind("click", _.bind(this.clusterCheckboxClicked, this));
        this.customMapControls
          .find(".locationChkBox")
          .bind("click", _.bind(this.showLocation, this));
        this.customMapControls
          .find(".gotoCurrentLocation")
          .bind("click", _.bind(this.gotoCurrentLocation, this));
        this.map.controls[google.maps.ControlPosition.TOP_RIGHT].push(
          this.customMapControls[0]
        );
      },

      //nochange checked
      _addTextNode: function (parentNode, elem, value, ns) {
        var ownerDocument = parentNode.ownerDocument,
          node = ownerDocument.createElementNS(ns, elem),
          txtNode = ownerDocument.createTextNode("");
        txtNode.nodeValue = value;
        node.appendChild(txtNode);
        parentNode.appendChild(node);
      },

      //nochange checked
      _addKmlStyles: function (documentNode, id, color) {
        var ownerDocument = documentNode.ownerDocument,
          styleNode = ownerDocument.createElementNS(NS_KML, "Style"),
          lineStyleNode = ownerDocument.createElementNS(NS_KML, "LineStyle"),
          polyStyleNode = ownerDocument.createElementNS(NS_KML, "PolyStyle");

        this._addTextNode(lineStyleNode, "color", "641400FF", NS_KML);
        this._addTextNode(lineStyleNode, "width", "1", NS_KML);
        styleNode.appendChild(lineStyleNode);
        this._addTextNode(polyStyleNode, "color", color, NS_KML);
        styleNode.appendChild(polyStyleNode);
        styleNode.setAttribute("id", id);
        documentNode.appendChild(styleNode);
      },

      //nochange checked
      polygonPathsFromBounds: function (bounds) {
        var path = new google.maps.MVCArray(),
          ne = bounds.getNorthEast(),
          sw = bounds.getSouthWest(),
          pathString = "";
        path.push(ne);
        path.push(new google.maps.LatLng(sw.lat(), ne.lng()));
        path.push(sw);
        path.push(new google.maps.LatLng(ne.lat(), sw.lng()));
        path.push(ne);
        path.forEach(function (latLng, idx) {
          pathString += [latLng.lng(), latLng.lat(), 0].join(",");
          pathString += " ";
        });
        return pathString;
      },

      //nochange checked
      addPlacemark: function (documentNode, options) {
        var ownerDocument = documentNode.ownerDocument,
          placemarkNode = ownerDocument.createElementNS(NS_KML, "Placemark"),
          descriptionNode = ownerDocument.createElementNS(
            NS_KML,
            "description"
          ),
          polygonNode = ownerDocument.createElementNS(NS_KML, "Polygon"),
          outerBoundaryNode = ownerDocument.createElementNS(
            NS_KML,
            "outerBoundaryIs"
          ),
          linearRingNode = ownerDocument.createElementNS(NS_KML, "LinearRing"),
          descriptionCdata = ownerDocument.createCDATASection(
            options.description
          );
        this._addTextNode(placemarkNode, "name", options.name, NS_KML);
        descriptionNode.appendChild(descriptionCdata);
        placemarkNode.appendChild(descriptionNode);

        this._addTextNode(
          placemarkNode,
          "styleUrl",
          "#" + options.style,
          NS_KML
        );
        this._addTextNode(
          linearRingNode,
          "coordinates",
          options.pathString,
          NS_KML
        );
        this._addTextNode(
          polygonNode,
          "gx:drawOrder",
          options.drawOrder,
          NS_GX
        );
        outerBoundaryNode.appendChild(linearRingNode);
        polygonNode.appendChild(outerBoundaryNode);
        placemarkNode.appendChild(polygonNode);
        documentNode.appendChild(placemarkNode);
      },

      //nochange checked
      createKml: function () {
        console.log("createKml");
        var xmlString =
            '<kml xmlns="http://www.opengis.net/kml/2.2" ' +
            'xmlns:gx="http://www.google.com/kml/ext/2.2"><Document/></kml>',
          parser = new DOMParser(),
          xmlDoc = parser.parseFromString(xmlString, "text/xml"),
          serializer = new XMLSerializer(),
          documentNode = xmlDoc.getElementsByTagName("Document")[0];

          console.log("xmlString : ", xmlString);

        this._addTextNode(documentNode, "name", this.options.name, NS_KML);
        this._addKmlStyles(documentNode, "reviewed", "99ff33ba");
        this._addKmlStyles(documentNode, "status-1", "99b0b0b0");
        this._addKmlStyles(documentNode, "status-2", "99808080");
        this._addKmlStyles(documentNode, "status-3", "99505050");
        this._addKmlStyles(documentNode, "status-4", "99202020");
        this._addKmlStyles(documentNode, "status-0", "99ff8040");
        this._addKmlStyles(documentNode, "cluster", "66ff9900");

        _(this.rectangleInfos).each(function (rectangleInfo) {
          var options = {
            pathString: this.polygonPathsFromBounds(
              rectangleInfo.options.bounds
            ),
            description: kmlDescription(rectangleInfo.options),
            name:
              rectangleInfo.options.subCell +
              (rectangleInfo.options.clusterName
                ? " " + rectangleInfo.options.clusterName
                : ""),
            style: rectangleInfo.isReviewed()
              ? "reviewed"
              : "status-" + rectangleInfo.getValue("status"),
            drawOrder: 2,
          };
          this.addPlacemark(documentNode, options);
        }, this);

        if (this.showCluster) {
          _(this.clusterPolygons).each(function (clusterPolygon) {
            var pathString = "";
            clusterPolygon.polygon.getPath().forEach(function (latLng, idx) {
              pathString += [latLng.lng(), latLng.lat(), 0].join(",");
              pathString += " ";
            });
            var options = {
              pathString: pathString,
              description: "",
              name: clusterPolygon.clusterName,
              style: "cluster",
              drawOrder: 1,
            };
            this.addPlacemark(documentNode, options);
          }, this);
        }

        return serializer.serializeToString(xmlDoc);
      },

      //nochange checked
      _exportKml: function (e) {
        e.preventDefault();
        var kmlString = this.createKml(),
          bb = new Blob([kmlString], { type: "text/plain" }),
          url = window.URL.createObjectURL(bb),
          a = document.createElement("a");

        a.setAttribute("href", url);
        a.setAttribute("download", this.options.name + ".kml");
        a.setAttribute("style", "display: none;");
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);
      },

      //checked
      _parseRowsCoordinates: function (entries) {
        var rows = [];
        var header = entries[0];
        _(entries.slice(1)).each(function (entry) {
          var rowObj = { Subcell_ID: entry[0] };
          for (var i = 1; i < entry.length; i += 2) {
            var longitude = entry[i];
            var latitude = entry[i + 1];
            var colLetterLong = String.fromCharCode(65 + i);
            var colLetterLat = String.fromCharCode(65 + (i + 1));
            rowObj["Longitude_" + colLetterLong] = longitude;
            rowObj["Latitude_" + colLetterLat] = latitude;
          }
          rows.push(rowObj);
        });

        return rows;
      },

      //checked
      _parseRows: function (entries) {
        var rows = [];
        var header = entries[0];
        _(entries.slice(1)).each(function (entry, index) {
          var rowObj = {};
          _(header).each(function (col, colIndex) {
            rowObj[col] = entry[colIndex];
          });
          rows.push(rowObj);
        });

        return rows;
      },

      //nochange checked
      convexHull: function (points) {
        points.sort(function (a, b) {
          return a.lat() != b.lat() ? a.lat() - b.lat() : a.lng() - b.lng();
        });

        var n = points.length;
        var hull = [];

        for (var i = 0; i < 2 * n; i++) {
          var j = i < n ? i : 2 * n - 1 - i;
          while (
            hull.length >= 2 &&
            this.removeMiddle(
              hull[hull.length - 2],
              hull[hull.length - 1],
              points[j]
            )
          )
            hull.pop();
          hull.push(points[j]);
        }

        hull.pop();
        return hull;
      },

      //nochange checked
      removeMiddle: function (a, b, c) {
        var cross =
          (a.lat() - b.lat()) * (c.lng() - b.lng()) -
          (a.lng() - b.lng()) * (c.lat() - b.lat());
        var dot =
          (a.lat() - b.lat()) * (c.lat() - b.lat()) +
          (a.lng() - b.lng()) * (c.lng() - b.lng());
        return cross < 0 || (cross == 0 && dot <= 0);
      },

      //updated checked
      getMapDataUrl: function (sheetName) {
        return (
          "https://sheets.googleapis.com/v4/spreadsheets/" +
          this.options.mapSpreadSheetId +
          "/values/" +
          sheetName +
          "?" +
          "key=YOUR_API_KEY"
        );
      },
    };

    return {
      BirdMap: BirdMap,
      createMap: function (options) {
        var defaults = {
          sheets: "1,2,3",
        };
        options = _.extend(defaults, options);
        var map = new BirdCount.BirdMap({
          zoom: 10,
          mapContainerId: options.mapContainerId,
          mapSpreadSheetId: options.mapSpreadSheetId,
          sheets: options.sheets.split(","),
          name: options.name,
          alert: function () {
            $(".page-alert-box").modal("show");
          },
        });
        map.render();
        return map;
      },
    }; 
  })();
