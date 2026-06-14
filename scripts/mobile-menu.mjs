/**
 * Configures actions and events for controlling the application drawer menu on mobile viewports.
 */
export function initMobileMenu() {
    // Query tracking elements for controls and layout targets
    const menuToggle = document.getElementById('menuToggle');
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const mobileMenuClose = document.getElementById('mobileMenuClose');

    // Guard Clause: Exit immediately if critical core nav elements are not detected on the current template
    if (!menuToggle || !mobileMenu || !mobileOverlay) {
        return;
    }

    // Helper: Reveals mobile menu panels and locks window scrolling behind the layer
    const openMobileMenu = () => {
        mobileMenu.classList.add('open');
        mobileOverlay.classList.add('open');
        document.body.style.overflow = 'hidden'; // Prevents background body scrolling
    };

    // Helper: Hides mobile menu panels and restores normal window navigation scrolling
    const closeMobileMenu = () => {
        mobileMenu.classList.remove('open');
        mobileOverlay.classList.remove('open');
        document.body.style.overflow = ''; // Clears inline overflow styling
    };

    // Event listeners to coordinate drawer operations
    menuToggle.addEventListener('click', openMobileMenu);
    mobileOverlay.addEventListener('click', closeMobileMenu); // Close panel if clicking the darkened blank backdrop space
    mobileMenuClose?.addEventListener('click', closeMobileMenu); // Optional chaining handle in case close button is missing

    // Auto-close menu panels when clicking any embedded direct link inside the drawer menu
    mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', closeMobileMenu);
    });
}