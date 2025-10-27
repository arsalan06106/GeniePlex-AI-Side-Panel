// Custom Links Module
export class CustomLinkManager {
  constructor() {
    this.init();
  }

  init() {
    this.initializeEventHandlers();
  }

  initializeEventHandlers() {
    // Add custom link button handler
    const addLinkBtn = document.getElementById('add-link-btn');
    if (addLinkBtn) {
      addLinkBtn.addEventListener('click', () => {
        // Support new two-field design (URL + Name) with fallback to legacy single field
        const urlEl = document.getElementById('custom-link-url-input') || document.getElementById('custom-link-input');
        const nameEl = document.getElementById('custom-link-name-input');
        const url = (urlEl?.value || '').trim();
        const name = (nameEl?.value || '').trim();
        if (url) {
          const result = this.addCustomLink(url, name);
          if (result) {
            if (urlEl) urlEl.value = '';
            if (nameEl) nameEl.value = '';
          }
        }
      });
    }

    // Allow adding custom links with Enter key (any of the inputs)
    const enterHandler = (e) => {
      if (e.key === 'Enter') {
        const urlEl = document.getElementById('custom-link-url-input') || document.getElementById('custom-link-input');
        const nameEl = document.getElementById('custom-link-name-input');
        const url = (urlEl?.value || '').trim();
        const name = (nameEl?.value || '').trim();
        if (url) {
          const result = this.addCustomLink(url, name);
          if (result) {
            if (urlEl) urlEl.value = '';
            if (nameEl) nameEl.value = '';
          }
        }
      }
    };
    const urlInput = document.getElementById('custom-link-url-input') || document.getElementById('custom-link-input');
    urlInput?.addEventListener('keypress', enterHandler);
    const nameInput = document.getElementById('custom-link-name-input');
    nameInput?.addEventListener('keypress', enterHandler);

    // Delete custom link handler
    const customLinksList = document.getElementById('custom-links-list');
    if (customLinksList) {
      customLinksList.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-link-btn')) {
          const id = parseInt(e.target.getAttribute('data-id'));
          this.deleteCustomLink(id);
        }
      });
    }
  }

  getCustomLinks() {
    try {
      const stored = localStorage.getItem('customLinks');
      if (!stored) {
        return [];
      }
      
      const links = JSON.parse(stored);
      if (!Array.isArray(links)) {
        console.warn('Custom links in localStorage is not an array, resetting');
        localStorage.removeItem('customLinks');
        return [];
      }
      
      // Validate each link
      const validLinks = links.filter(link => {
        if (!link || typeof link !== 'object') {
          console.warn('Invalid link object:', link);
          return false;
        }
        if (!link.id || !link.name || !link.url) {
          console.warn('Link missing required properties:', link);
          return false;
        }
        return true;
      });
      
      if (validLinks.length !== links.length) {
        this.saveCustomLinks(validLinks); // Save the cleaned list
      }
      
      return validLinks;
    } catch (error) {
      console.error('Error parsing custom links from localStorage:', error);
      localStorage.removeItem('customLinks');
      return [];
    }
  }

  saveCustomLinks(links) {
    try {
      if (!Array.isArray(links)) {
        console.error('Attempted to save non-array as custom links:', links);
        return;
      }
      
      localStorage.setItem('customLinks', JSON.stringify(links));
    } catch (error) {
      console.error('Error saving custom links to localStorage:', error);
    }
  }

  renderCustomLinks() {
    const linksList = document.getElementById('custom-links-list');
    const customButtonsContainer = document.getElementById('custom-buttons-container');
    
    if (!linksList || !customButtonsContainer) {
      console.error('Required DOM elements not found for renderCustomLinks');
      return;
    }
    
    // Clear existing content
    linksList.innerHTML = '';
    customButtonsContainer.innerHTML = '';

    const customLinks = this.getCustomLinks();

    customLinks.forEach(link => {
      // Ensure link has required properties
      if (!link.id || !link.name || !link.url) {
        console.warn('Invalid custom link detected:', link);
        return;
      }

      // Render link in settings with proper checked state
      const linkItem = document.createElement('div');
      linkItem.className = 'toggle-item';
      linkItem.innerHTML = `
        <span>${link.name}</span>
        <div class="custom-link-actions">
          <label class="switch" title="Enable/Disable">
            <input type="checkbox" id="toggle-custom-${link.id}" ${link.enabled !== false ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
          <button class="icon-btn delete-link-btn" title="Delete" aria-label="Delete" data-id="${link.id}">✕</button>
        </div>
      `;
      linksList.appendChild(linkItem);

      // Always render button in toolbar, but control visibility via CSS
      const button = document.createElement('button');
      button.className = 'btn';
      button.setAttribute('data-url', link.url);
  button.setAttribute('data-label', link.name);
      button.setAttribute('data-custom-id', link.id);
      button.setAttribute('draggable', 'true');
      button.style.display = (link.enabled !== false) ? 'flex' : 'none';
      button.innerHTML = `
        <img src="https://www.google.com/s2/favicons?domain=${new URL(link.url).hostname}" alt="${link.name} Icon" style="flex:none;line-height:1; width: 20px; height: 20px;" />
        <span>${link.name}</span>
      `;
      customButtonsContainer.appendChild(button);
    });
    
    // Re-initialize drag and drop for new buttons if toolbar is already initialized
    const toolbar = document.getElementById('toolbar');
    if (toolbar && toolbar.dragAndDropInitialized) {
      // Ensure new buttons are draggable
      toolbar.querySelectorAll('.btn').forEach(button => {
        button.setAttribute('draggable', 'true');
      });
    }
    
  }

  addCustomLink(url, providedName) {
    try {
      // Validate and normalize URL
      if (!url || typeof url !== 'string' || url.trim() === '') {
        alert('Please enter a valid URL');
        return null;
      }
      
      url = url.trim();
      
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      
      const urlObj = new URL(url);
      const links = this.getCustomLinks();
      
      // Check if URL already exists
      if (links.some(link => link.url === url)) {
        alert('This URL already exists in your custom links.');
        return null;
      }
      
      let name = (providedName || '').trim();
      if (!name) {
        name = urlObj.hostname.replace('www.', '').split('.')[0];
      }
      
      // Ensure unique ID - use a more robust approach
      let uniqueId;
      let attempts = 0;
      do {
        const baseId = Date.now();
        const randomSuffix = Math.floor(Math.random() * 10000);
        uniqueId = baseId + randomSuffix;
        attempts++;
      } while (links.some(link => link.id === uniqueId) && attempts < 100);
      
      if (attempts >= 100) {
        console.error('Unable to generate unique ID after 100 attempts');
        alert('Error creating custom link. Please try again.');
        return null;
      }
      
      const newLink = {
        id: uniqueId,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        url: url,
        enabled: true
      };
      
      
      links.push(newLink);
      this.saveCustomLinks(links);
      this.renderCustomLinks();
      
      // Re-initialize toggles to include the new link
      if (window.settingsManager) {
        window.settingsManager.initializeToggles();
      }
      
      return newLink;
    } catch (error) {
      console.error('Error adding custom link:', error);
      alert('Please enter a valid URL (e.g., example.com or https://example.com)');
      return null;
    }
  }

  deleteCustomLink(id) {
    let links = this.getCustomLinks();
    const linkToDelete = links.find(link => link.id == id); // Use loose equality to handle string/number conversion
    
    
    if (!linkToDelete) {
      console.warn(`Custom link with id ${id} not found`);
      return null;
    }
    
    // Show premium deletion modal
    this.showDeleteModal(linkToDelete.name, () => {
      // Remove from custom links
      links = links.filter(link => link.id != id); // Use loose equality to handle string/number conversion
      this.saveCustomLinks(links);
      
      
      // Remove from localStorage toggles
      localStorage.removeItem(`show_custom-${id}`);
      
      // Remove button from toolbar immediately
      const toolbarButton = document.querySelector(`[data-custom-id="${id}"]`);
      if (toolbarButton) {
        toolbarButton.remove();
      }
      
      // Update button order to remove deleted link
      if (window.saveManager && linkToDelete) {
        const savedOrder = window.saveManager.getButtonOrder();
        const updatedOrder = savedOrder.filter((url) => url !== linkToDelete.url);
        window.saveManager.saveButtonOrder(updatedOrder);
      }
      
      // Re-render settings list to remove the deleted item
      this.renderCustomLinks();
      
      if (window.settingsManager) {
        window.settingsManager.initializeToggles();
      }
    });
  }

  showDeleteModal(linkName, onConfirm) {
    const localizedMessage = chrome.i18n.getMessage('deleteConfirmation', [linkName]);

    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'dialog-overlay';

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'dialog-content';

    // Premium icon
    const icon = document.createElement('div');
    icon.className = 'dialog-icon';
    icon.innerHTML = `
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#f2b8b5"/>
      </svg>
    `;

    // Title
    const title = document.createElement('h3');
    title.textContent = 'Delete Custom Link';
    title.className = 'dialog-title';

    // Message
    const message = document.createElement('p');
    message.textContent = localizedMessage;
    message.className = 'dialog-message';

    // Buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'dialog-buttons';

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'dialog-button cancel';

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.className = 'dialog-button delete';

    // Event handlers
    const closeModal = () => {
      modalOverlay.classList.remove('visible');
      setTimeout(() => {
        if (modalOverlay.parentNode) {
          modalOverlay.parentNode.removeChild(modalOverlay);
        }
      }, 200);
    };

    cancelBtn.addEventListener('click', closeModal);
    
    deleteBtn.addEventListener('click', () => {
      closeModal();
      onConfirm();
    });

    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        closeModal();
      }
    });

    // Assemble modal
    buttonsContainer.appendChild(cancelBtn);
    buttonsContainer.appendChild(deleteBtn);
    
    modalContent.appendChild(icon);
    modalContent.appendChild(title);
    modalContent.appendChild(message);
    modalContent.appendChild(buttonsContainer);
    
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);

    // Animate in
    requestAnimationFrame(() => {
      modalOverlay.classList.add('visible');
    });
  }

  toggleCustomLink(id, enabled) {
    const links = this.getCustomLinks();
    const link = links.find(link => link.id == id); // Use loose equality
    
    if (link) {
      link.enabled = enabled;
      this.saveCustomLinks(links);
      
      if (window.saveManager) {
        window.saveManager.saveToggleState(`custom-${id}`, enabled);
      } else {
        localStorage.setItem(`show_custom-${id}`, enabled.toString());
      }
      
      
      // Update button visibility
      const button = document.querySelector(`[data-url="${link.url}"]`);
      if (button) {
        button.style.display = enabled ? 'flex' : 'none';
      }
      
      return true;
    }
    
    console.warn(`Custom link ${id} not found for toggle`);
    return false;
  }
}
