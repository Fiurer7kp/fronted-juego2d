# 📦 Referencia de Assets - ASHEN CROWN

## Estructura de Carpetas

```
frontend/src/assets/
├── characters/          # Sprites de personajes y enemigos
├── weapons/            # Iconos y sprites de armas
├── maps/               # Mapas de niveles
├── tiles/              # Elementos de terreno
└── ui/                 # Elementos de interfaz
```

---

## 🎭 Characters (Personajes)

Contiene 21 sprites PNG de personajes en estilo pixel art Game Boy Advance.

### Distribución recomendada por clase:
- **character-01 a 03:** Líderes/Caballeros
- **character-04 a 06:** Jinetes/Montados
- **character-07 a 09:** Magos/Apoyo
- **character-10 a 12:** Guerreros/Atacadores
- **character-13 a 15:** Reclutas/Velocidad
- **character-16 a 18:** Ladrones/Sigilo
- **character-19 a 21:** Enemigos especiales

### Archivos:
- `character-1.png` hasta `character-21.png`

---

## ⚔️ Weapons (Armas)

Contiene 26 iconos JPG de armas diferentes para uso en menús e inventario.

### Tipos de armas incluidas:
- Espadas (Sword)
- Lanzas (Lance)
- Arcos (Bow)
- Hachas (Axe)
- Varitas de Magia (Staff/Wand)
- Ballesta (Crossbow)
- Y más...

### Archivos:
- `weapon-01.jpg` hasta `weapon-26.jpg`

### Notas:
- Optimizados para UI en 32x32 o 64x64px
- Formato JPG para menor tamaño de descarga

---

## 🗺️ Maps (Mapas)

Contiene los mapas de los 7 niveles de la campaña.

### Archivos:
- `map-01-noche-valdris.jpg` - Mapa 1: La noche que Valdris cayó

### Mapas pendientes de crear:
- `map-02-pueblo-agricola.jpg` - Lo que Charles trajo consigo
- `map-03-academia-magia.jpg` - La Corona del Alba
- `map-04-ciudad-castillo.jpg` - Hermanos de guerra
- `map-05-sotanos-castillo.jpg` - Bajo el castillo
- `map-06-capilla-rey.jpg` - La capilla del rey
- `map-07-cementerio-real.jpg` - El cementerio real

---

## 🌿 Tiles (Elementos de Terreno)

Contiene elementos de terreno individuales para construir mapas basados en cuadrículas.

### Archivos:
- `tile-forest.png` - Bosque (trampa: reduce movimiento)
- `tile-mountain.png` - Montaña (obstáculo)
- `tile-road.png` - Camino (neutro)
- `tile-water.png` - Agua (obstáculo)
- `tile-obstacle.png` - Obstáculo decorativo

### Tipos de terreno del juego:
1. **Neutro** (Camino) - Movimiento normal, sin efectos
2. **Trampa** (Bosque) - Reduce movimiento, disminuye defensa
3. **Potenciador** - Aumenta ataque/defensa (no disponible aún)
4. **Obstáculo** (Montaña, Agua) - Bloquea movimiento

---

## 🎨 UI (Interfaz)

Contiene elementos visuales para la interfaz de usuario.

### Archivos:
- `ui-logo.png` - Logo del juego
- `ui-reinhardt-portrait.jpg` - Retrato de Reinhardt (personaje principal)

### Elementos UI pendientes de crear:
- Botones
- Barras de vida (HP)
- Indicadores de turno
- Iconos de estado
- Marcos de diálogo
- Menús

---

## 📋 Recomendaciones de Uso

### Para Personajes:
```typescript
// Ejemplo en TypeScript
const characterSprite = {
  path: 'assets/characters/character-1.png',
  width: 32,
  height: 32,
  class: 'Líder',
  name: 'Reinhardt'
};
```

### Para Armas:
```typescript
// Ejemplo en TypeScript
const weaponIcon = {
  path: 'assets/weapons/weapon-01.jpg',
  width: 32,
  height: 32,
  type: 'Espada',
  uses: 25,
  damage: 8
};
```

### Para Mapas:
```typescript
// Ejemplo en TypeScript
const mapData = {
  path: 'assets/maps/map-01-noche-valdris.jpg',
  width: 800,
  height: 600,
  gridSize: 32,
  objective: 'Acabar con los enemigos'
};
```

### Para Tiles:
```typescript
// Ejemplo en TypeScript
const tileDefinitions = {
  forest: {
    path: 'assets/tiles/tile-forest.png',
    type: 'TRAP',
    movementModifier: -1,
    defenseModifier: -2
  },
  mountain: {
    path: 'assets/tiles/tile-mountain.png',
    type: 'OBSTACLE',
    walkable: false
  }
};
```

---

## 🔧 Integración con el Backend

Los assets están organizados para ser fácilmente referenciables desde:
- Componentes React/Vue
- Servicios TypeScript
- Modelos de datos del backend (en rutas API)

### Estructura de rutas API recomendada:
```
/api/assets/characters/{id}
/api/assets/weapons/{id}
/api/assets/maps/{id}
/api/assets/tiles/{type}
```

---

## 📝 Notas Importantes

1. **Optimización:** Los assets deben estar optimizados para navegadores
2. **Resolución:** Mantener coherencia en tamaño para mantener la estética pixel art
3. **Nomenclatura:** Seguir la convención `tipo-numero.extension` para fácil identificación
4. **Versionado:** Si se actualizan assets, considerar versioning en nombres

---

*Última actualización: Abril 2026*
