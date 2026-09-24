<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
  xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.opengis.net/sld http://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd">
  <NamedLayer>
    <Name>clc_nivel1</Name>
    <UserStyle>
      <Title>CORINE Land Cover - Nivel 1</Title>
      <FeatureTypeStyle>
        <Rule>
          <Name>artificializados</Name>
          <Title>1. Territorios artificializados</Title>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo>
              <ogc:PropertyName>nivel1</ogc:PropertyName>
              <ogc:Literal>1</ogc:Literal>
            </ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#E6004D</CssParameter></Fill>
            <Stroke>
              <CssParameter name="stroke">#4d4d4d</CssParameter>
              <CssParameter name="stroke-width">0.3</CssParameter>
            </Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Name>agricolas</Name>
          <Title>2. Territorios agrícolas</Title>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo>
              <ogc:PropertyName>nivel1</ogc:PropertyName>
              <ogc:Literal>2</ogc:Literal>
            </ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#FFFFA8</CssParameter></Fill>
            <Stroke>
              <CssParameter name="stroke">#4d4d4d</CssParameter>
              <CssParameter name="stroke-width">0.3</CssParameter>
            </Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Name>bosques</Name>
          <Title>3. Bosques y áreas seminaturales</Title>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo>
              <ogc:PropertyName>nivel1</ogc:PropertyName>
              <ogc:Literal>3</ogc:Literal>
            </ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#4C7300</CssParameter></Fill>
            <Stroke>
              <CssParameter name="stroke">#4d4d4d</CssParameter>
              <CssParameter name="stroke-width">0.3</CssParameter>
            </Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Name>humedales</Name>
          <Title>4. Áreas húmedas</Title>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo>
              <ogc:PropertyName>nivel1</ogc:PropertyName>
              <ogc:Literal>4</ogc:Literal>
            </ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#A6A6FF</CssParameter></Fill>
            <Stroke>
              <CssParameter name="stroke">#4d4d4d</CssParameter>
              <CssParameter name="stroke-width">0.3</CssParameter>
            </Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Name>aguas</Name>
          <Title>5. Superficies de agua</Title>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo>
              <ogc:PropertyName>nivel1</ogc:PropertyName>
              <ogc:Literal>5</ogc:Literal>
            </ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#00CCF2</CssParameter></Fill>
            <Stroke>
              <CssParameter name="stroke">#4d4d4d</CssParameter>
              <CssParameter name="stroke-width">0.3</CssParameter>
            </Stroke>
          </PolygonSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
