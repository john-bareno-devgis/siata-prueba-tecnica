<?xml version="1.0" encoding="UTF-8"?>
<!--
  Estilo por nivel 3 CLC (23 categorías presentes en este dataset, de 425
  polígonos). Colores generados por familia de tono según nivel1 (mismo
  criterio cartográfico oficial de CORINE Land Cover: subcategorías de una
  misma familia comparten matiz y varían en luminosidad). Filtra por el
  texto exacto de "nivel3" (viene del campo nivel_3 del .gpkg fuente, no
  se deriva por substring).
-->
<StyledLayerDescriptor version="1.0.0"
  xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.opengis.net/sld http://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd">
  <NamedLayer>
    <Name>clc_nivel3</Name>
    <UserStyle>
      <Title>CORINE Land Cover - Nivel 3</Title>
      <FeatureTypeStyle>
        <Rule>
          <Name>n111</Name>
          <Title>1.1.1. Tejido urbano continuo</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>nivel3</ogc:PropertyName><ogc:Literal>1.1.1. Tejido urbano continuo</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#861C37</CssParameter></Fill>
            <Stroke><CssParameter name="stroke">#4d4d4d</CssParameter><CssParameter name="stroke-width">0.2</CssParameter></Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Name>n112</Name>
          <Title>1.1.2. Tejido urbano discontinuo</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>nivel3</ogc:PropertyName><ogc:Literal>1.1.2. Tejido urbano discontinuo</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#A22242</CssParameter></Fill>
            <Stroke><CssParameter name="stroke">#4d4d4d</CssParameter><CssParameter name="stroke-width">0.2</CssParameter></Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Name>n121</Name>
          <Title>1.2.1. Zonas industriales o comerciales</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>nivel3</ogc:PropertyName><ogc:Literal>1.2.1. Zonas industriales o comerciales</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#BE284E</CssParameter></Fill>
            <Stroke><CssParameter name="stroke">#4d4d4d</CssParameter><CssParameter name="stroke-width">0.2</CssParameter></Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Name>n124</Name>
          <Title>1.2.4. Aeropuertos</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>nivel3</ogc:PropertyName><ogc:Literal>1.2.4. Aeropuertos</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#D4355C</CssParameter></Fill>
            <Stroke><CssParameter name="stroke">#4d4d4d</CssParameter><CssParameter name="stroke-width">0.2</CssParameter></Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Name>n131</Name>
          <Title>1.3.1. Zonas de extracción minera</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>nivel3</ogc:PropertyName><ogc:Literal>1.3.1. Zonas de extracción minera</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#DA5173</CssParameter></Fill>
            <Stroke><CssParameter name="stroke">#4d4d4d</CssParameter><CssParameter name="stroke-width">0.2</CssParameter></Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Name>n141</Name>
          <Title>1.4.1. Zonas verdes urbanas</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>nivel3</ogc:PropertyName><ogc:Literal>1.4.1. Zonas verdes urbanas</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#E06D89</CssParameter></Fill>
            <Stroke><CssParameter name="stroke">#4d4d4d</CssParameter><CssParameter name="stroke-width">0.2</CssParameter></Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Name>n142</Name>
          <Title>1.4.2. Instalaciones recreativas</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>nivel3</ogc:PropertyName><ogc:Literal>1.4.2. Instalaciones recreativas</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#E689A0</CssParameter></Fill>
            <Stroke><CssParameter name="stroke">#4d4d4d</CssParameter><CssParameter name="stroke-width">0.2</CssParameter></Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Name>n231</Name>
          <Title>2.3.1. Pastos limpios</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>nivel3</ogc:PropertyName><ogc:Literal>2.3.1. Pastos limpios</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#866C1C</CssParameter></Fill>
            <Stroke><CssParameter name="stroke">#4d4d4d</CssParameter><CssParameter name="stroke-width">0.2</CssParameter></Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Name>n232</Name>
          <Title>2.3.2. Pastos arbolados</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>nivel3</ogc:PropertyName><ogc:Literal>2.3.2. Pastos arbolados</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#A28222</CssParameter></Fill>
            <Stroke><CssParameter name="stroke">#4d4d4d</CssParameter><CssParameter name="stroke-width">0.2</CssParameter></Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Name>n233</Name>
          <Title>2.3.3. Pastos enmalezados</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>nivel3</ogc:PropertyName><ogc:Literal>2.3.3. Pastos enmalezados</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#BE9928</CssParameter></Fill>
            <Stroke><CssParameter name="stroke">#4d4d4d</CssParameter><CssParameter name="stroke-width">0.2</CssParameter></Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Name>n242</Name>
          <Title>2.4.2. Mosaico de pastos y cultivos</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>nivel3</ogc:PropertyName><ogc:Literal>2.4.2. Mosaico de pastos y cultivos</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#D4AC35</CssParameter></Fill>
            <Stroke><CssParameter name="stroke">#4d4d4d</CssParameter><CssParameter name="stroke-width">0.2</CssParameter></Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Name>n243</Name>
          <Title>2.4.3. Mosaico de cultivos, pastos y espacios naturales</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>nivel3</ogc:PropertyName><ogc:Literal>2.4.3. Mosaico de cultivos, pastos y espacios naturales</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#DAB751</CssParameter></Fill>
            <Stroke><CssParameter name="stroke">#4d4d4d</CssParameter><CssParameter name="stroke-width">0.2</CssParameter></Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Name>n244</Name>
          <Title>2.4.4. Mosaico de pastos con espacios naturales</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>nivel3</ogc:PropertyName><ogc:Literal>2.4.4. Mosaico de pastos con espacios naturales</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#E0C36D</CssParameter></Fill>
            <Stroke><CssParameter name="stroke">#4d4d4d</CssParameter><CssParameter name="stroke-width">0.2</CssParameter></Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Name>n245</Name>
          <Title>2.4.5. Mosaico de cultivos con espacios naturales</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>nivel3</ogc:PropertyName><ogc:Literal>2.4.5. Mosaico de cultivos con espacios naturales</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#E6CE89</CssParameter></Fill>
            <Stroke><CssParameter name="stroke">#4d4d4d</CssParameter><CssParameter name="stroke-width">0.2</CssParameter></Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Name>n311</Name>
          <Title>3.1.1. Bosque denso</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>nivel3</ogc:PropertyName><ogc:Literal>3.1.1. Bosque denso</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#3F861C</CssParameter></Fill>
            <Stroke><CssParameter name="stroke">#4d4d4d</CssParameter><CssParameter name="stroke-width">0.2</CssParameter></Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Name>n313</Name>
          <Title>3.1.3. Bosque fragmentado</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>nivel3</ogc:PropertyName><ogc:Literal>3.1.3. Bosque fragmentado</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#4B9E21</CssParameter></Fill>
            <Stroke><CssParameter name="stroke">#4d4d4d</CssParameter><CssParameter name="stroke-width">0.2</CssParameter></Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Name>n314</Name>
          <Title>3.1.4. Bosque de galería y ripario</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>nivel3</ogc:PropertyName><ogc:Literal>3.1.4. Bosque de galería y ripario</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#56B626</CssParameter></Fill>
            <Stroke><CssParameter name="stroke">#4d4d4d</CssParameter><CssParameter name="stroke-width">0.2</CssParameter></Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Name>n315</Name>
          <Title>3.1.5. Plantación forestal</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>nivel3</ogc:PropertyName><ogc:Literal>3.1.5. Plantación forestal</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#62CE2B</CssParameter></Fill>
            <Stroke><CssParameter name="stroke">#4d4d4d</CssParameter><CssParameter name="stroke-width">0.2</CssParameter></Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Name>n321</Name>
          <Title>3.2.1. Herbazal</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>nivel3</ogc:PropertyName><ogc:Literal>3.2.1. Herbazal</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#72D641</CssParameter></Fill>
            <Stroke><CssParameter name="stroke">#4d4d4d</CssParameter><CssParameter name="stroke-width">0.2</CssParameter></Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Name>n322</Name>
          <Title>3.2.2. Arbustal</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>nivel3</ogc:PropertyName><ogc:Literal>3.2.2. Arbustal</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#84DB59</CssParameter></Fill>
            <Stroke><CssParameter name="stroke">#4d4d4d</CssParameter><CssParameter name="stroke-width">0.2</CssParameter></Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Name>n323</Name>
          <Title>3.2.3. Vegetación secundaria o en transición</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>nivel3</ogc:PropertyName><ogc:Literal>3.2.3. Vegetación secundaria o en transición</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#96E071</CssParameter></Fill>
            <Stroke><CssParameter name="stroke">#4d4d4d</CssParameter><CssParameter name="stroke-width">0.2</CssParameter></Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Name>n333</Name>
          <Title>3.3.3. Tierras desnudas y degradadas</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>nivel3</ogc:PropertyName><ogc:Literal>3.3.3. Tierras desnudas y degradadas</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#A8E689</CssParameter></Fill>
            <Stroke><CssParameter name="stroke">#4d4d4d</CssParameter><CssParameter name="stroke-width">0.2</CssParameter></Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Name>n513</Name>
          <Title>5.1.3. Canales</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>nivel3</ogc:PropertyName><ogc:Literal>5.1.3. Canales</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#1C6C86</CssParameter></Fill>
            <Stroke><CssParameter name="stroke">#4d4d4d</CssParameter><CssParameter name="stroke-width">0.2</CssParameter></Stroke>
          </PolygonSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
