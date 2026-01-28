// Mobile Menu Toggle
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

hamburger.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    hamburger.classList.toggle('active');
});

// Close menu when clicking on a link
document.querySelectorAll('.nav-menu a').forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        hamburger.classList.remove('active');
    });
});

// Smooth Scrolling
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Active Navigation Link on Scroll
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-menu a');

window.addEventListener('scroll', () => {
    let current = '';
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (pageYOffset >= sectionTop - 200) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
});

// Contact Form Handler
const kontaktForm = document.querySelector('.kontakt-form');
if (kontaktForm) {
    kontaktForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = kontaktForm.querySelector('input[type="text"]').value;
        const email = kontaktForm.querySelector('input[type="email"]').value;
        const message = kontaktForm.querySelector('textarea').value;
        
        // Simulate form submission
        alert(`Vielen Dank ${name}! Deine Nachricht wurde gesendet. Wir melden uns bald bei dir.`);
        kontaktForm.reset();
    });
}

// Animate elements on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe all cards
document.querySelectorAll('.index-card, .tipp-card, .ressource-card, .stat-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(card);
});

// Dynamic Index Price Updates (Simulation)
function updateIndexPrices() {
    const indexValues = document.querySelectorAll('.index-value');
    const badges = document.querySelectorAll('.index-card .badge');
    
    indexValues.forEach((value, index) => {
        const currentValue = parseFloat(value.textContent.replace('$', '').replace(',', ''));
        const change = (Math.random() - 0.5) * 50; // Random change between -25 and +25
        const newValue = (currentValue + change).toFixed(2);
        
        // Animate value change
        value.style.transition = 'color 0.3s';
        value.textContent = `$${parseFloat(newValue).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    });
    
    badges.forEach(badge => {
        const currentChange = parseFloat(badge.textContent.replace('%', ''));
        const newChange = (currentChange + (Math.random() - 0.5) * 2).toFixed(1);
        
        if (newChange > 0) {
            badge.classList.remove('negative');
            badge.classList.add('positive');
            badge.textContent = `+${newChange}%`;
        } else {
            badge.classList.remove('positive');
            badge.classList.add('negative');
            badge.textContent = `${newChange}%`;
        }
    });
}

// Update prices every 10 seconds (simulation)
setInterval(updateIndexPrices, 10000);

// Add parallax effect to hero
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const heroContent = document.querySelector('.hero-content');
    
    if (heroContent) {
        heroContent.style.transform = `translateY(${scrolled * 0.3}px)`;
        heroContent.style.opacity = 1 - (scrolled / 700);
    }
});

// Add loading animation
window.addEventListener('load', () => {
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.5s';
        document.body.style.opacity = '1';
    }, 100);
});

// Copy to clipboard functionality for links
const createCopyButton = (text) => {
    navigator.clipboard.writeText(text).then(() => {
        console.log('Copied to clipboard:', text);
    });
};

// Add hover effects for interactive elements
document.querySelectorAll('.btn, .ressource-link, .social-link').forEach(el => {
    el.addEventListener('mouseenter', function() {
        this.style.transition = 'all 0.3s ease';
    });
});

// Keyboard navigation support
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        navMenu.classList.remove('active');
        hamburger.classList.remove('active');
    }
});

// Add current year to footer
const footerYear = document.querySelector('.footer-bottom p');
if (footerYear) {
    const currentYear = new Date().getFullYear();
    footerYear.textContent = footerYear.textContent.replace('2026', currentYear);
}

// Daily Tip Rotation
const tips = [
    {
        title: "📈 Dollar-Cost Averaging (DCA)",
        content: "Investiere regelmäßig feste Beträge, unabhängig vom aktuellen Preis. Diese Strategie minimiert das Risiko von ungünstigen Einstiegszeitpunkten und glättet die Volatilität. Bei einem DCA-Plan kaufst du z.B. jeden Monat für 100€ Bitcoin - egal ob der Kurs bei 30.000€ oder 50.000€ steht.",
        level: "Anfänger",
        category: "Strategie"
    },
    {
        title: "🎯 Diversifikation ist Key",
        content: "Setze nicht alles auf eine Karte. Verteile dein Portfolio auf verschiedene Indices und Asset-Klassen, um Risiken zu streuen und von verschiedenen Markttrends zu profitieren. Die 60-30-10 Regel: 60% etablierte Coins, 30% Mid-Caps, 10% High-Risk/High-Reward.",
        level: "Anfänger",
        category: "Risk Management"
    },
    {
        title: "📊 Technische Analyse nutzen",
        content: "Lerne Charts zu lesen und erkenne Muster. RSI, MACD und Moving Averages sind essenzielle Tools für erfolgreiche Entry- und Exit-Points. Ein RSI über 70 signalisiert überkaufte Bedingungen, unter 30 überverkaufte - ideale Zeitpunkte für Trades.",
        level: "Fortgeschritten",
        category: "Analyse"
    },
    {
        title: "🛡️ Stop-Loss Orders setzen",
        content: "Schütze dein Kapital durch automatische Stop-Loss Orders. Definiere vorab, wieviel Verlust du bereit bist zu akzeptieren. Eine gängige Regel: Setze Stop-Loss 7-10% unter deinem Einstiegspreis bei volatilen Assets.",
        level: "Fortgeschritten",
        category: "Risk Management"
    },
    {
        title: "💰 Nur investieren was du verlieren kannst",
        content: "Krypto-Märkte sind volatil. Investiere niemals Geld, das du für deinen Lebensunterhalt brauchst oder dir geliehen hast. Eine Faustregel: Maximal 5-10% deines Gesamtvermögens in Krypto, abhängig von deiner Risikotoleranz.",
        level: "Anfänger",
        category: "Grundlagen"
    },
    {
        title: "⏰ Market Timing vermeiden",
        content: "Den perfekten Zeitpunkt zu finden ist nahezu unmöglich. Konzentriere dich auf langfristige Trends statt auf kurzfristige Schwankungen. 'Time in the market beats timing the market' - dieses Prinzip gilt auch für Krypto.",
        level: "Fortgeschritten",
        category: "Psychologie"
    },
    {
        title: "🔍 Research vor Investment (DYOR)",
        content: "Do Your Own Research ist essentiell. Analysiere Whitepapers, Team-Background, Tokenomics und Use-Cases bevor du investierst. Prüfe: Wer ist im Team? Welches Problem löst das Projekt? Wie ist die Token-Distribution?",
        level: "Anfänger",
        category: "Grundlagen"
    }
];

function getDailyTipIndex() {
    const today = new Date();
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
    return dayOfYear % tips.length;
}

function updateDailyTip() {
    const tipTitle = document.getElementById('tipTitle');
    const tipContent = document.getElementById('tipContent');
    const tipDate = document.getElementById('tipDate');
    
    if (tipTitle && tipContent) {
        const todaysTip = tips[getDailyTipIndex()];
        tipTitle.textContent = todaysTip.title;
        tipContent.textContent = todaysTip.content;
        
        // Update meta tags
        const metaContainer = document.querySelector('.tip-meta-main');
        if (metaContainer) {
            metaContainer.innerHTML = `
                <span class="difficulty ${todaysTip.level.toLowerCase()}">${todaysTip.level}</span>
                <span class="category">${todaysTip.category}</span>
            `;
        }
    }
    
    if (tipDate) {
        const today = new Date();
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        tipDate.textContent = today.toLocaleDateString('de-DE', options);
    }
}

// Update tip on page load
document.addEventListener('DOMContentLoaded', updateDailyTip);

console.log('🚀 RBC Excellence Platform loaded successfully!');
