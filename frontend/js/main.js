// Main application functionality
document.addEventListener('DOMContentLoaded', function() {
    // Load categories
    loadCategories();
    
    // Load featured hymns
    loadFeaturedHymns();
    
    // Language cards event listeners
    const languageCards = document.querySelectorAll('.language-card');
    languageCards.forEach(card => {
        card.addEventListener('click', function() {
            const language = this.getAttribute('data-lang');
            window.location.href = `pages/language.html?lang=${encodeURIComponent(language)}`;
        });
    });
    
    // Search functionality
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('search-input');
    
    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
});

// Load categories
async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        const data = await response.json();
        
        if (data.status === 'success') {
            displayCategories(data.data.categories);
        } else {
            console.error('Error loading categories:', data.message);
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Display categories
function displayCategories(categories) {
    const categoriesGrid = document.getElementById('categories-grid');
    if (!categoriesGrid) return;
    
    categoriesGrid.innerHTML = '';
    
    categories.slice(0, 6).forEach(category => {
        const categoryCard = document.createElement('div');
        categoryCard.className = 'category-card';
        categoryCard.innerHTML = `
            <img src="img/category-${category.name.toLowerCase()}.jpg" alt="${category.name}">
            <div class="category-content">
                <h3>${category.name}</h3>
                <p>${category.description}</p>
                <a href="pages/category.html?cat=${encodeURIComponent(category.name)}" class="btn">Explore</a>
            </div>
        `;
        categoriesGrid.appendChild(categoryCard);
    });
}

// Load featured hymns
async function loadFeaturedHymns() {
    try {
        const response = await fetch('/api/hymns?limit=6');
        const data = await response.json();
        
        if (data.status === 'success') {
            displayFeaturedHymns(data.data.hymns);
        } else {
            console.error('Error loading featured hymns:', data.message);
        }
    } catch (error) {
        console.error('Error loading featured hymns:', error);
    }
}

// Display featured hymns
function displayFeaturedHymns(hymns) {
    const hymnsGrid = document.getElementById('featured-hymns');
    if (!hymnsGrid) return;
    
    hymnsGrid.innerHTML = '';
    
    hymns.forEach(hymn => {
        const hymnCard = document.createElement('div');
        hymnCard.className = 'hymn-card';
        hymnCard.innerHTML = `
            <div class="hymn-content">
                <h3>${hymn.title}</h3>
                <p>${hymn.description.substring(0, 100)}...</p>
                <div class="hymn-actions">
                    <button onclick="playHymn('${hymn._id}')"><i class="fas fa-play"></i></button>
                    <button onclick="shareHymn('${hymn._id}')"><i class="fas fa-share-alt"></i></button>
                    <button onclick="downloadHymn('${hymn._id}')"><i class="fas fa-download"></i></button>
                    <button onclick="toggleFavorite('${hymn._id}')"><i class="far fa-heart"></i></button>
                </div>
            </div>
        `;
        hymnsGrid.appendChild(hymnCard);
    });
}

// Perform search
function performSearch() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;
    
    const query = searchInput.value.trim();
    if (query) {
        window.location.href = `pages/search.html?q=${encodeURIComponent(query)}`;
    }
}

// Play hymn
function playHymn(hymnId) {
    window.location.href = `pages/hymn.html?id=${hymnId}`;
}

// Share hymn
function shareHymn(hymnId) {
    // Implementation for sharing hymn
    if (navigator.share) {
        navigator.share({
            title: 'Orthodox Hymn',
            text: 'Check out this beautiful Orthodox hymn',
            url: `${window.location.origin}/pages/hymn.html?id=${hymnId}`
        })
        .catch(error => console.log('Error sharing:', error));
    } else {
        // Fallback for browsers that don't support Web Share API
        prompt('Copy this link to share:', `${window.location.origin}/pages/hymn.html?id=${hymnId}`);
    }
}

// Download hymn
async function downloadHymn(hymnId) {
    try {
        // First increment download count
        await fetch(`/api/hymns/${hymnId}/download`, {
            method: 'POST'
        });
        
        // Then get the hymn to download
        const response = await fetch(`/api/hymns/${hymnId}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            const hymn = data.data.hymn;
            const link = document.createElement('a');
            link.href = hymn.audioUrl;
            link.download = `${hymn.title}.mp3`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    } catch (error) {
        console.error('Error downloading hymn:', error);
    }
}

// Toggle favorite
async function toggleFavorite(hymnId) {
    if (!auth.user) {
        auth.showFlash('Please login to add favorites', 'error');
        return;
    }
    
    try {
        // Check if already favorited
        const response = await fetch('/api/users/favorites/list', {
            method: 'GET',
            headers: auth.getAuthHeader()
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            const isFavorited = data.data.favorites.some(fav => fav._id === hymnId);
            
            if (isFavorited) {
                // Remove from favorites
                await fetch(`/api/users/favorites/${hymnId}`, {
                    method: 'DELETE',
                    headers: auth.getAuthHeader()
                });
                auth.showFlash('Removed from favorites', 'success');
            } else {
                // Add to favorites
                await fetch(`/api/users/favorites/${hymnId}`, {
                    method: 'POST',
                    headers: auth.getAuthHeader()
                });
                auth.showFlash('Added to favorites', 'success');
            }
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
    }
}