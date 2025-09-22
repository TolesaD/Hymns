let currentFilter = 'recent';

const languageMap = {
  'am': 'Amharic',
  'om': 'Afan Oromo',
  'ti': 'Tigrigna',
  'en': 'English'
};

document.addEventListener('DOMContentLoaded', function() {
    loadCategories();
    
    const languageCards = document.querySelectorAll('.language-card');
    languageCards.forEach(card => {
        card.addEventListener('click', function() {
            const language = this.getAttribute('data-lang');
            window.location.href = `pages/language.html?lang=${encodeURIComponent(language)}`;
        });
    });
    
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

    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.getAttribute('data-filter');
            loadFeaturedHymns(currentFilter);
        });
    });
    
    loadFeaturedHymns(currentFilter);
});

async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        const data = await response.json();
        
        if (data.status === 'success') {
            displayCategories(data.data.categories);
        } else {
            console.error('Error loading categories:', data.message);
            auth.showFlash('Error loading categories', 'error');
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        auth.showFlash('Error loading categories', 'error');
    }
}

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

async function loadFeaturedHymns(filter = 'recent') {
    try {
        let url = '/api/hymns?limit=9';
        
        if (filter === 'popular') {
            url += '&sort=-listens';
        } else if (filter === 'random') {
            url += '&random=true';
        } else {
            url += '&sort=-createdAt';
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === 'success') {
            displayFeaturedHymns(data.data.hymns, filter);
        } else {
            console.error('Error loading featured hymns:', data.message);
            auth.showFlash('Error loading hymns', 'error');
        }
    } catch (error) {
        console.error('Error loading featured hymns:', error);
        auth.showFlash('Error loading hymns', 'error');
    }
}

function displayFeaturedHymns(hymns, filter) {
    const hymnsGrid = document.getElementById('featured-hymns');
    if (!hymnsGrid) return;
    
    hymnsGrid.innerHTML = '';
    
    if (hymns.length === 0) {
        hymnsGrid.innerHTML = '<p>No hymns available yet.</p>';
        return;
    }
    
    hymns.forEach(hymn => {
        const hymnCard = document.createElement('div');
        hymnCard.className = 'hymn-card';
        hymnCard.innerHTML = `
            <div class="hymn-content">
                <h3>${hymn.title}</h3>
                <p><strong>Language:</strong> ${languageMap[hymn.lang] || hymn.lang}</p>
                <p><strong>Category:</strong> ${hymn.category?.name || 'Unknown'}</p>
                <p>${hymn.description.substring(0, 80)}...</p>
                <div class="hymn-stats">
                    <span><i class="fas fa-play"></i> ${hymn.listens || 0}</span>
                    <span><i class="fas fa-download"></i> ${hymn.downloads || 0}</span>
                    <span><i class="fas fa-heart"></i> ${hymn.favorites || 0}</span>
                </div>
                <div class="hymn-actions">
                    <button onclick="playHymn('${hymn._id}')"><i class="fas fa-play"></i></button>
                    <button onclick="shareHymn('${hymn._id}')"><i class="fas fa-share-alt"></i></button>
                    <button onclick="downloadHymn('${hymn._id}')"><i class="fas fa-download"></i></button>
                    <button onclick="toggleFavorite('${hymn._id}')"><i class="far fa-heart"></i></button>
                </div>
                <a href="pages/hymn.html?id=${hymn._id}" class="btn" style="display: block; text-align: center; margin-top: 10px;">View Details</a>
            </div>
        `;
        hymnsGrid.appendChild(hymnCard);
    });
}

function performSearch() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;
    
    const query = searchInput.value.trim();
    if (query) {
        window.location.href = `pages/search.html?q=${encodeURIComponent(query)}`;
    }
}

function playHymn(hymnId) {
    window.location.href = `pages/hymn.html?id=${hymnId}`;
}

function shareHymn(hymnId) {
    if (navigator.share) {
        navigator.share({
            title: 'Orthodox Hymn',
            text: 'Check out this beautiful Orthodox hymn',
            url: `${window.location.origin}/pages/hymn.html?id=${hymnId}`
        })
        .catch(error => {
            console.error('Error sharing:', error);
            auth.showFlash('Error sharing hymn', 'error');
        });
    } else {
        const shareUrl = `${window.location.origin}/pages/hymn.html?id=${hymnId}`;
        navigator.clipboard.writeText(shareUrl)
            .then(() => auth.showFlash('Link copied to clipboard', 'success'))
            .catch(error => {
                console.error('Error copying link:', error);
                auth.showFlash('Error copying link', 'error');
            });
    }
}

async function downloadHymn(hymnId) {
    try {
        await fetch(`/api/hymns/${hymnId}/download`, {
            method: 'POST'
        });
        
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
            auth.showFlash('Download started', 'success');
        } else {
            auth.showFlash('Error downloading hymn', 'error');
        }
    } catch (error) {
        console.error('Error downloading hymn:', error);
        auth.showFlash('Error downloading hymn', 'error');
    }
}

async function toggleFavorite(hymnId) {
    if (!auth.user) {
        auth.showFlash('Please login to add favorites', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/users/favorites/list', {
            method: 'GET',
            headers: auth.getAuthHeader()
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            const isFavorited = data.data.favorites.some(fav => fav._id === hymnId);
            
            if (isFavorited) {
                await fetch(`/api/users/favorites/${hymnId}`, {
                    method: 'DELETE',
                    headers: auth.getAuthHeader()
                });
                auth.showFlash('Removed from favorites', 'success');
            } else {
                await fetch(`/api/users/favorites/${hymnId}`, {
                    method: 'POST',
                    headers: auth.getAuthHeader()
                });
                auth.showFlash('Added to favorites', 'success');
            }
        } else {
            auth.showFlash('Error updating favorites', 'error');
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
        auth.showFlash('Error updating favorites', 'error');
    }
}