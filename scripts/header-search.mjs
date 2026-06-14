/**
 * Initializes the header search functionality for both desktop and mobile buttons.
 * It dynamically turns a static button/label into an active input field.
 */
export function initHeaderSearch() {
    // Prevent duplicate initialization if the search input already exists on the page
    if (document.getElementById('searchInput')) return;

    /**
     * Attaches dynamic search behavior to a given button element.
     * * @param {HTMLElement} btn - The button element to attach the click listener to.
     * @param {string|null} labelSelector - CSS selector for the text label inside the button (if applicable).
     */
    function attachSearchBehavior(btn, labelSelector) {
        if (!btn) return; // Guard clause if the button doesn't exist on the current page

        const label = labelSelector ? btn.querySelector(labelSelector) : null;
        let input = null;
        let active = false; // Tracks whether the input field is currently open

        /**
         * Handles opening the search input or triggering a search if already open.
         */
        function openSearch(e) {
            // If the user clicks the actual input text field, don't trigger navigate/close
            if (e.target.tagName === 'INPUT') return;
            
            e.preventDefault();

            // If the user clicks the button while the input is already open, treat it as a submit
            if (active) {
                navigate();
                return;
            }

            active = true;
            btn.classList.add('is-active'); // Expands the button via CSS

            // Dynamically create the search input element
            input = document.createElement('input');
            input.id = 'searchInput';
            input.type = 'text';
            input.placeholder = 'Search anime…';
            input.setAttribute('aria-label', 'Search anime');

            // Blends input completely into the container button
            Object.assign(input.style, {
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'inherit',
                font: 'inherit',
                fontSize: '14px',
                // Match the width of the text label it's replacing, or fallback to 120px
                width: label ? `${label.offsetWidth}px` : '120px',
                minWidth: '80px',
            });

            // Swap out the text label for the input field, or append it to the button
            if (label) {
                label.replaceWith(input);
            } else {
                // For mobile, append the input after the SVG icon
                btn.appendChild(input);
            }

            input.focus(); // Auto-focus the input for immediate typing

            // Handle keyboard shortcuts while typing
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') navigate();
                if (e.key === 'Escape') closeSearch();
            });

            // Closes the search if clicking outside of it
            setTimeout(() => {
                document.addEventListener('click', handleOutsideClick);
            }, 0);
        }

        /**
         * Redirects the user to the search results page.
         */
        function navigate() {
            const q = input ? input.value.trim() : '';
            
            // Redirect if the user typed something; otherwise, just close the input
            if (q.length > 0) {
                window.location.href = `search.html?q=${encodeURIComponent(q)}`;
            } else {
                closeSearch();
            }
        }

        /**
         * Closes the search input and restores the original button/label state.
         */
        function closeSearch() {
            if (!active) return;
            active = false;
            btn.classList.remove('is-active'); // Shrinks the button back to a circle
            document.removeEventListener('click', handleOutsideClick);
            
            // Revert the DOM back to its original layout
            if (label && input) {
                input.replaceWith(label); // Put the text label back
            } else if (input) {
                input.remove(); // Just remove the input if there was no label
            }
            input = null;
        }

        function handleOutsideClick(e) {
            if (!btn.contains(e.target)) {
                closeSearch();
            }
        }

        btn.addEventListener('click', openSearch);
    }

    // Initialize the behavior for the desktop search button (replaces a <span> label)
    attachSearchBehavior(document.querySelector('.search-btn'), 'span');
    
    // Initialize the behavior for the mobile search button (appends directly, no label)
    attachSearchBehavior(document.querySelector('.mobile-search-btn'), null);
}