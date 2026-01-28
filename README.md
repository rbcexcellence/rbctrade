# RBC Excellence - Krypto Asset Indices Plattform

Eine professionelle Website für Krypto Asset Indices, Trading-Tipps und Ressourcen.

## 🚀 Features

- **Responsive Design** - Optimiert für Desktop, Tablet und Mobile
- **Krypto Indices** - Übersicht über verschiedene Krypto-Markt-Indices
- **Trading Tipps** - Expertentipps für erfolgreiches Trading
- **Ressourcen** - Lernmaterialien und Guides
- **Newsletter** - Anmeldefunktion für Updates
- **Kontaktformular** - Direkte Kommunikation
- **Smooth Scrolling** - Flüssige Navigation
- **Animationen** - Moderne Scroll-Animationen

## 📁 Dateistruktur

```
rbctrade/
├── index.html          # Hauptseite
├── styles.css          # Styling
├── script.js           # JavaScript-Funktionalität
└── README.md          # Diese Datei
```

## 🎨 Design

- **Farbschema**: Dunkles Theme mit Primary Color (Indigo/Purple)
- **Typografie**: Inter Font Family
- **Komponenten**: Cards, Badges, Buttons, Forms
- **Layout**: CSS Grid & Flexbox

## 📱 Sections

1. **Hero** - Einführung mit Call-to-Actions
2. **Indices** - 6 verschiedene Krypto-Indices mit Live-Daten
3. **Trading Tipps** - 9 Expert-Tipps kategorisiert nach Schwierigkeit
4. **Ressourcen** - 6 Lern-Ressourcen
5. **Newsletter** - Email-Anmeldung
6. **Kontakt** - Kontaktformular und Informationen
7. **Footer** - Links und rechtliche Hinweise

## 🛠️ Verwendung

1. Öffne `index.html` in einem Browser
2. Für lokale Entwicklung kannst du einen Server verwenden:
   ```bash
   # Python
   python -m http.server 8000
   
   # Node.js
   npx serve
   ```

## 🌐 Deployment

Für die Domain **rbc-excellence.com**:

1. Lade alle Dateien auf deinen Webserver hoch
2. Stelle sicher, dass `index.html` im Root-Verzeichnis liegt
3. DNS-Einstellungen für rbc-excellence.com konfigurieren

## ✨ Features im Detail

### JavaScript-Funktionalität
- Mobile Menu Toggle
- Smooth Scrolling
- Active Navigation Highlighting
- Form Handling
- Scroll Animations
- Simulated Price Updates

### Responsive Breakpoints
- Mobile: < 480px
- Tablet: < 768px
- Desktop: > 768px

## 📝 Anpassungen

### Farben ändern
Bearbeite die CSS-Variablen in `styles.css`:
```css
:root {
    --primary-color: #6366f1;
    --secondary-color: #8b5cf6;
    /* ... weitere Farben */
}
```

### Indices hinzufügen
Füge neue Index-Cards in `index.html` im Bereich `<section id="indices">` hinzu.

### Trading Tipps erweitern
Neue Tipp-Cards im Bereich `<section id="tipps">` einfügen.

## 🔒 Hinweise

- Dies ist ein Frontend-Template
- Für echte Live-Daten benötigst du API-Integration
- Formulare sind aktuell nur simuliert (kein Backend)
- Für Produktion sollte ein Backend/CMS integriert werden

## 📄 Lizenz

Dieses Projekt ist für rbc-excellence.com erstellt.

## 🤝 Support

Bei Fragen: info@rbc-excellence.com
