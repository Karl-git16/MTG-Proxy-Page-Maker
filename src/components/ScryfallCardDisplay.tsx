import React, { useState, useEffect } from 'react';

interface CardImageUris {
  small?: string;
  normal?: string;
  large?: string;
  png?: string;
  art_crop?: string;
  border_crop?: string;
}

interface CardFace {
  name: string;
  mana_cost?: string;
  type_line: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  flavor_text?: string;
  image_uris?: CardImageUris;
}

interface ScryfallCard {
  id: string;
  name: string;
  type_line: string;
  mana_cost?: string;
  set_name: string;
  rarity: string;
  power?: string;
  toughness?: string;
  oracle_text?: string;
  flavor_text?: string;
  artist?: string;
  image_uris?: CardImageUris;
  card_faces?: CardFace[]; 
  layout: string;
  scryfall_uri: string;
}

interface DeckCard {
  quantity: number;
  name: string;
  set?: string;
  collectorNumber?: string;
  cardData?: ScryfallCard;
  loading?: boolean;
  error?: string;
  uniqueId: string; // Add unique ID for tracking during drag
  currentFaceIndex?: number; // For double-faced cards
  // Manual card options
  addBlackBorder?: boolean; // Whether to add black border on export
  addBlackBorderBack?: boolean; // Whether to add black border on back face
  isDoubleSided?: boolean; // Whether this is marked as double-sided
  backFaceName?: string; // Name of the back face for double-sided cards
  customImage?: string; // Base64 data URL of uploaded image
  customBackImage?: string; // Base64 data URL for back face if double-sided
  isCustomCard?: boolean; // Flag to identify custom cards
  customUniversalBack?: string; // Base64 data URL for universal back image
}

interface GridBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const ScryfallCardDisplay: React.FC = () => {
  const [decklistInput, setDecklistInput] = useState<string>('');
  const [cards, setCards] = useState<DeckCard[]>([]);
  const [loadingAll, setLoadingAll] = useState<boolean>(false);
  const [draggedCard, setDraggedCard] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [selectedCard, setSelectedCard] = useState<ScryfallCard | null>(null);
  const [selectedCardFace, setSelectedCardFace] = useState<number>(0);
  const [showAddCardPopup, setShowAddCardPopup] = useState<boolean>(false);
  const [universalBackImage, setUniversalBackImage] = useState<string | null>(null);
  const [showUniversalBackPopup, setShowUniversalBackPopup] = useState<boolean>(false);
  const [newCardForm, setNewCardForm] = useState({
  name: '',
  quantity: 1,
  set: '',
  collectorNumber: '',
  addBlackBorder: true,
  isDoubleSided: false,
  backFaceName: '',
  // Add these new properties for image upload
  uploadedImage: null as string | null,
  imageFile: null as File | null,
  uploadedBackImage: null as string | null,
  backImageFile: null as File | null
});


  const openCardPopup = (cardData: ScryfallCard, faceIndex: number = 0) => {
    setSelectedCard(cardData);
    setSelectedCardFace(faceIndex);
  };

  const closeCardPopup = () => {
    setSelectedCard(null);
  };

  const removeCard = (cardId: string) => {
  setCards(prevCards => prevCards.filter(card => card.uniqueId !== cardId));
  };
  
  // Check if a card is double-sided
  const isDoubleSided = (card: ScryfallCard): boolean => {
    return card.layout === 'transform' ||
          card.layout === 'modal_dfc' ||
          card.layout === 'double_faced_token' ||
          card.layout === 'reversible_card';
  };

  // Get the correct image for a card face
  const getCardImage = (card: ScryfallCard | undefined, faceIndex: number = 0, customImage?: string, customBackImage?: string): string | undefined => {
    // For custom cards with back face
    if (customImage && customBackImage) {
      return faceIndex === 0 ? customImage : customBackImage;
    }
    
    // For custom cards with only front face
    if (customImage) {
      return customImage;
    }
    
    // Otherwise use the original Scryfall logic
    if (card?.card_faces && card.card_faces[faceIndex]?.image_uris) {
      return card.card_faces[faceIndex].image_uris?.normal || card.card_faces[faceIndex].image_uris?.small;
    }
    return card?.image_uris?.normal || card?.image_uris?.small;
  };

  // Get large image for popup
  const getCardImageLarge = (card: ScryfallCard | undefined, faceIndex: number = 0): string | undefined => {
    // Handle custom cards
    if (card?.id === 'custom') {
      const customCard = card as any;
      if (customCard.customBackImage && faceIndex === 1) {
        return customCard.customBackImage;
      }
      return customCard.customImage;
    }
    
    // Handle Scryfall cards
    if (card?.card_faces && card.card_faces[faceIndex]?.image_uris) {
      return card.card_faces[faceIndex].image_uris?.large || 
            card.card_faces[faceIndex].image_uris?.normal || 
            card.card_faces[faceIndex].image_uris?.small;
    }
    return card?.image_uris?.large || card?.image_uris?.normal || card?.image_uris?.small;
  };

  // Get card name for a specific face
  const getCardName = (card: ScryfallCard, faceIndex: number = 0): string => {
    if (card.card_faces && card.card_faces[faceIndex]) {
      return card.card_faces[faceIndex].name;
    }
    return card.name;
  };

  // Function to flip a card face
  const flipCard = (cardId: string) => {
    setCards(prevCards => 
      prevCards.map(card => {
        if (card.uniqueId === cardId) {
          // Handle Scryfall double-sided cards
          if (card.cardData && isDoubleSided(card.cardData)) {
            const maxFaces = card.cardData.card_faces?.length || 1;
            const currentFace = card.currentFaceIndex || 0;
            return {
              ...card,
              currentFaceIndex: (currentFace + 1) % maxFaces
            };
          }
          // Handle custom double-sided cards
          else if (card.isCustomCard && card.isDoubleSided && card.customBackImage) {
            const currentFace = card.currentFaceIndex || 0;
            return {
              ...card,
              currentFaceIndex: (currentFace + 1) % 2 // Toggle between 0 and 1
            };
          }
        }
        return card;
      })
    );
  };

  //check if card is flippable
  const isFlippableCard = (card: any) => {
    // Check if it's a Scryfall double-sided card
    if (card && isDoubleSided(card)) {
      return true;
    }
    // Check if it's a custom double-sided card
    if (card && card.id === 'custom' && (card.customBackImage || card.isDoubleSided)) {
      return true;
    }
    return false;
  };
  // Add global styles to ensure full page coverage
  useEffect(() => {
    // Store original styles
    const originalBodyStyle = document.body.style.cssText;
    const originalHtmlStyle = document.documentElement.style.cssText;

    // Apply full-page styles
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.minHeight = '100vh';
    document.documentElement.style.margin = '0';
    document.documentElement.style.padding = '0';
    document.documentElement.style.minHeight = '100vh';

    // Add CSS animation for spinner
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .drag-preview {
        opacity: 0.5;
        transform: scale(0.95);
        transition: all 0.2s ease;
      }
      
      .drag-over {
        border: 1px dashed #60a5fa !important;
        background-color: rgba(96, 165, 250, 0.1) !important;
      }
    `;
    document.head.appendChild(style);

    // Cleanup on unmount
    return () => {
      document.body.style.cssText = originalBodyStyle;
      document.documentElement.style.cssText = originalHtmlStyle;
      document.head.removeChild(style);
    };
  }, []);

  const parseDecklist = (input: string): DeckCard[] => {
    const lines = input.trim().split('\n').filter(line => line.trim());
    const parsedCards: DeckCard[] = [];

    for (const line of lines) {
      // Remove foil markers and other flags before parsing
      const cleanLine = line.trim().replace(/\*F\*/g, '').replace(/\*CMDR\*/g, '').trim();
      // Match patterns like "1 Lightning Bolt", "2x Island", "4 Counterspell", "1 Meren of Clan Nel Toth (CMM) 346"
      const matchWithSet = cleanLine.match(/^(\d+)x?\s+(.+?)\s+\(([A-Z0-9]+)\)\s+(\S+)$/i);
      const matchBasic = cleanLine.match(/^(\d+)x?\s+(.+)$/i);
      
      if (matchWithSet) {
        // Format: "1 Meren of Clan Nel Toth (CMM) 346"
        const quantity = parseInt(matchWithSet[1]);
        const name = matchWithSet[2].trim();
        const set = matchWithSet[3].toUpperCase();
        const collectorNumber = matchWithSet[4];
        parsedCards.push({ 
          quantity, 
          name, 
          set, 
          collectorNumber, 
          uniqueId: `${name}-${set}-${collectorNumber}-${Date.now()}-${Math.random()}` 
        });
      } else if (matchBasic) {
        // Format: "1 Lightning Bolt"
        const quantity = parseInt(matchBasic[1]);
        const name = matchBasic[2].trim();
        parsedCards.push({ 
          quantity, 
          name, 
          uniqueId: `${name}-${Date.now()}-${Math.random()}` 
        });
      }
    }

    return parsedCards;
  };

  const fetchCard = async (cardName: string, set?: string, collectorNumber?: string): Promise<ScryfallCard | null> => {
    try {
      let url: string;
      
      if (set && collectorNumber) {
        // Fetch specific printing using set code and collector number
        url = `https://api.scryfall.com/cards/${set.toLowerCase()}/${collectorNumber}`;
      } else {
        // Fallback to fuzzy name search
        url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Card not found');
      }

      const data: ScryfallCard = await response.json();
      return data;
    } catch (err) {
      console.error(`Failed to fetch ${cardName}${set ? ` (${set}) ${collectorNumber}` : ''}:`, err);
      return null;
    }
  };

  const loadDecklist = async (): Promise<void> => {
    if (!decklistInput.trim()) {
      return;
    }

    const parsedCards = parseDecklist(decklistInput);
    if (parsedCards.length === 0) {
      return;
    }

    setLoadingAll(true);
    
    // Expand cards based on quantity - create individual card entries
    const expandedCards: DeckCard[] = [];
    for (const card of parsedCards) {
      for (let i = 0; i < card.quantity; i++) {
        expandedCards.push({
        quantity: 1,
        name: card.name,
        set: card.set,
        collectorNumber: card.collectorNumber,
        loading: true,
        currentFaceIndex: 0,
        uniqueId: `${card.name}-${card.set || ''}-${card.collectorNumber || ''}-${Date.now()}-${i}-${Math.random()}`
      });
      }
    }
    
    setCards(prevCards => [...prevCards, ...expandedCards]);

    // Create unique identifiers for fetching (combining name, set, collector number)
    const uniqueCardIdentifiers = [...new Set(parsedCards.map(card => 
      `${card.name}|||${card.set || ''}|||${card.collectorNumber || ''}`
    ))];
    const cardDataMap = new Map<string, ScryfallCard>();

    // Fetch each unique card once
    await Promise.all(
      uniqueCardIdentifiers.map(async (identifier) => {
        const [cardName, set, collectorNumber] = identifier.split('|||');
        const cardData = await fetchCard(
          cardName, 
          set || undefined, 
          collectorNumber || undefined
        );
        if (cardData) {
          cardDataMap.set(identifier, cardData);
        }
      })
    );

    setCards(prevCards => {
      // Get the newly added cards from the end of the list
      const updatedNewCards = expandedCards.map((card) => {
        const identifier = `${card.name}|||${card.set || ''}|||${card.collectorNumber || ''}`;
        const cardData = cardDataMap.get(identifier);
        if (cardData) {
          return {
            ...card,
            cardData,
            loading: false
          };
        } else {
          return {
            ...card,
            error: `Card "${card.name}" not found`,
            loading: false
          };
        }
      });
      
      // Keep old cards and update the new ones we just added
      return [...prevCards.slice(0, -expandedCards.length), ...updatedNewCards];
    });
    setLoadingAll(false);
  };

  const clearDecklist = (): void => {
    setCards([]);
    setDecklistInput('');
    setDraggedCard(null);
    setDragOverIndex(null);
    setSelectedCard(null);
  };

  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    setDraggedCard(cardId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', cardId);
  };

  const handleDragEnd = () => {
    setDraggedCard(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    const draggedCardId = e.dataTransfer.getData('text/plain');
    if (!draggedCardId) return;

    const draggedIndex = cards.findIndex(card => card.uniqueId === draggedCardId);
    if (draggedIndex === -1 || draggedIndex === dropIndex) return;

    // Create new array with reordered cards
    const newCards = [...cards];
    const [draggedItem] = newCards.splice(draggedIndex, 1);
    newCards.splice(dropIndex, 0, draggedItem);

    setCards(newCards);
    setDraggedCard(null);
    setDragOverIndex(null);
  };

  const exportCardsAsImages = async () => { 
    const W = 1101;
    const H = 804;
    const x0_list = [127, 1249, 2373]
    const x1_list = [127+W, 1249+W, 2373+W]
    const y0_list = [288, 1092, 1896, 2700, 3504, 4308];
    const y1_list = [288+H, 1092+H, 1896+H, 2700+H, 3504+H, 4308+H];
    
    // Create grid boxes (same as Python: 3x6 = 18 cards)
    const gridBoxes: GridBox[] = [];
    for (let y = 0; y < y0_list.length; y++) {
      for (let x = 0; x < x0_list.length; x++) {
        gridBoxes.push({
          x0: x0_list[x],
          x1: x1_list[x], 
          y0: y0_list[y],
          y1: y1_list[y]
        });
      }
    }

    const maxCardsPerSheet = gridBoxes.length; // 18
    const cardsPerPage = maxCardsPerSheet;
    const totalPages = Math.ceil(cards.length / cardsPerPage);
    
    // Helper function to compress canvas to under 25MB
    const compressCanvas = async (canvas: HTMLCanvasElement, baseName: string): Promise<void> => {
      const maxSizeBytes = 25 * 1024 * 1024; // 25MB
      let quality = 0.9;
      let blob: Blob | null = null;
      
      // Try progressively lower quality until under 25MB
      while (quality > 0.1) {
        blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
        });
        
        if (blob && blob.size <= maxSizeBytes) {
          break;
        }
        
        const currentSizeMB = (blob?.size || 0) / (1024 * 1024);
        console.log(`${baseName}: ${currentSizeMB.toFixed(2)}MB at quality ${quality.toFixed(2)}, compressing further...`);
        quality -= 0.1;
      }
      
      if (blob) {
        const finalSizeMB = blob.size / (1024 * 1024);
        console.log(`${baseName}: Final size ${finalSizeMB.toFixed(2)}MB at quality ${quality.toFixed(2)}`);
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = baseName;
        link.click();
        URL.revokeObjectURL(url);
        console.log(`✅ ${baseName} created successfully`);
      }
    };
    
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      const startIndex = pageIndex * cardsPerPage;
      const endIndex = Math.min(startIndex + cardsPerPage, cards.length);
      const pageCards = cards.slice(startIndex, endIndex);
      
      // ============== FRONT SIDE ==============
      const frontCanvas = document.createElement('canvas');
      const frontCtx = frontCanvas.getContext('2d');
      if (!frontCtx) continue;
      
      frontCanvas.width = 3600;
      frontCanvas.height = 5400;
      
      frontCtx.fillStyle = 'white';
      frontCtx.fillRect(0, 0, frontCanvas.width, frontCanvas.height);
      
      // Load and draw front face of each card
      const frontImagePromises = pageCards.map(async (card, index) => {
        if ((!card.cardData && !card.customImage) || index >= gridBoxes.length) return;
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        return new Promise<void>((resolve) => {
          img.onload = () => {
            const box = gridBoxes[index];
            const shouldAddBorder = card.addBlackBorder !== undefined ? card.addBlackBorder : true;
            
            if (shouldAddBorder) {
              const borderSize = 37.5;
              const cardWidth = (box.x1 - box.x0) - (2 * borderSize);
              const cardHeight = (box.y1 - box.y0) - (2 * borderSize);
              const fullWidth = box.x1 - box.x0;
              const fullHeight = box.y1 - box.y0;
              
              frontCtx.save();
              frontCtx.translate(box.x0 + fullWidth/2, box.y0 + fullHeight/2);
              frontCtx.rotate(Math.PI / 2);
              
              frontCtx.fillStyle = 'black';
              frontCtx.fillRect(-fullHeight/2, -fullWidth/2, fullHeight, fullWidth);
              frontCtx.drawImage(img, -cardHeight/2, -cardWidth/2, cardHeight, cardWidth);
              
              // Rounded corners
              frontCtx.fillStyle = 'black';
              const cornerRadius = 46;
              const maskOffset = 1;
              const expandedRadius = cornerRadius + maskOffset;

              frontCtx.beginPath();
              frontCtx.arc(-cardHeight/2 + cornerRadius - maskOffset, -cardWidth/2 + cornerRadius - maskOffset, expandedRadius, Math.PI, 3*Math.PI/2);
              frontCtx.lineTo(-cardHeight/2 - maskOffset, -cardWidth/2 - maskOffset);
              frontCtx.closePath();
              frontCtx.fill();

              frontCtx.beginPath();
              frontCtx.arc(cardHeight/2 - cornerRadius + maskOffset, -cardWidth/2 + cornerRadius - maskOffset, expandedRadius, 3*Math.PI/2, 2*Math.PI);
              frontCtx.lineTo(cardHeight/2 + maskOffset, -cardWidth/2 - maskOffset);
              frontCtx.closePath();
              frontCtx.fill();

              frontCtx.beginPath();
              frontCtx.arc(-cardHeight/2 + cornerRadius - maskOffset, cardWidth/2 - cornerRadius + maskOffset, expandedRadius, Math.PI/2, Math.PI);
              frontCtx.lineTo(-cardHeight/2 - maskOffset, cardWidth/2 + maskOffset);
              frontCtx.closePath();
              frontCtx.fill();

              frontCtx.beginPath();
              frontCtx.arc(cardHeight/2 - cornerRadius + maskOffset, cardWidth/2 - cornerRadius + maskOffset, expandedRadius, 0, Math.PI/2);
              frontCtx.lineTo(cardHeight/2 + maskOffset, cardWidth/2 + maskOffset);
              frontCtx.closePath();
              frontCtx.fill();
              
              frontCtx.restore();
            } else {
              const fullWidth = box.x1 - box.x0;
              const fullHeight = box.y1 - box.y0;
              
              frontCtx.save();
              frontCtx.translate(box.x0 + fullWidth/2, box.y0 + fullHeight/2);
              frontCtx.rotate(Math.PI / 2);
              frontCtx.drawImage(img, -fullHeight/2, -fullWidth/2, fullHeight, fullWidth);
              frontCtx.restore();
            }
            
            console.log(`Sheet${pageIndex + 1} Front: Inserted ${card.name}`);
            resolve();
          };
          
          img.onerror = () => {
            console.error(`Failed to load front image for ${card.name}`);
            resolve();
          };
          
          // Get front face image
          let imageUrl: string | undefined;
          if (card.customImage) {
            imageUrl = card.customImage;
          } else if (card.cardData) {
            imageUrl = getCardImage(card.cardData, 0); // Always use face 0 for front
          }

          if (imageUrl) {
            img.src = imageUrl;
          } else {
            console.warn(`No front image URL found for ${card.name}`);
            resolve();
          }
        });
      });
      
      await Promise.all(frontImagePromises);

      await compressCanvas(frontCanvas, `Sheet${pageIndex + 1}_Front.jpg`);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // ============== BACK SIDE ==============
      const backCanvas = document.createElement('canvas');
      const backCtx = backCanvas.getContext('2d');
      if (!backCtx) continue;
      
      backCanvas.width = 3600;
      backCanvas.height = 5400;
      
      backCtx.fillStyle = 'white';
      backCtx.fillRect(0, 0, backCanvas.width, backCanvas.height);
      
      // Load and draw back face of each card (REVERSED ORDER for printing)
      const backImagePromises = pageCards.map(async (card, index) => {
        if ((!card.cardData && !card.customImage) || index >= gridBoxes.length) return;
        
        // REVERSE THE INDEX for proper alignment when printing double-sided
        // Cards in row: [0,1,2] -> backs should be [2,1,0]
        const row = Math.floor(index / 3);
        const col = index % 3;
        const reversedCol = 2 - col; // Reverse column: 0->2, 1->1, 2->0
        const reversedIndex = row * 3 + reversedCol;
        const box = gridBoxes[reversedIndex]; // Use reversed position
        
        return new Promise<void>((resolve) => {
          // Determine back image
          const isDoubleSidedCard = (card.cardData && isDoubleSided(card.cardData)) || 
                                    (card.isCustomCard && card.isDoubleSided && card.customBackImage);
          
          if (isDoubleSidedCard) {
            // Use the back face image for double-sided cards
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
              const shouldAddBorder = card.addBlackBorder !== undefined ? card.addBlackBorder : true;
              
              if (shouldAddBorder) {
                const borderSize = 37.5;
                const cardWidth = (box.x1 - box.x0) - (2 * borderSize);
                const cardHeight = (box.y1 - box.y0) - (2 * borderSize);
                const fullWidth = box.x1 - box.x0;
                const fullHeight = box.y1 - box.y0;
                
                backCtx.save();
                backCtx.translate(box.x0 + fullWidth/2, box.y0 + fullHeight/2);
                backCtx.rotate(Math.PI / 2);
                backCtx.rotate(Math.PI);
                
                backCtx.fillStyle = 'black';
                backCtx.fillRect(-fullHeight/2, -fullWidth/2, fullHeight, fullWidth);
                backCtx.drawImage(img, -cardHeight/2, -cardWidth/2, cardHeight, cardWidth);
                
                // Rounded corners
                backCtx.fillStyle = 'black';
                const cornerRadius = 46;
                const maskOffset = 1;
                const expandedRadius = cornerRadius + maskOffset;

                backCtx.beginPath();
                backCtx.arc(-cardHeight/2 + cornerRadius - maskOffset, -cardWidth/2 + cornerRadius - maskOffset, expandedRadius, Math.PI, 3*Math.PI/2);
                backCtx.lineTo(-cardHeight/2 - maskOffset, -cardWidth/2 - maskOffset);
                backCtx.closePath();
                backCtx.fill();

                backCtx.beginPath();
                backCtx.arc(cardHeight/2 - cornerRadius + maskOffset, -cardWidth/2 + cornerRadius - maskOffset, expandedRadius, 3*Math.PI/2, 2*Math.PI);
                backCtx.lineTo(cardHeight/2 + maskOffset, -cardWidth/2 - maskOffset);
                backCtx.closePath();
                backCtx.fill();

                backCtx.beginPath();
                backCtx.arc(-cardHeight/2 + cornerRadius - maskOffset, cardWidth/2 - cornerRadius + maskOffset, expandedRadius, Math.PI/2, Math.PI);
                backCtx.lineTo(-cardHeight/2 - maskOffset, cardWidth/2 + maskOffset);
                backCtx.closePath();
                backCtx.fill();

                backCtx.beginPath();
                backCtx.arc(cardHeight/2 - cornerRadius + maskOffset, cardWidth/2 - cornerRadius + maskOffset, expandedRadius, 0, Math.PI/2);
                backCtx.lineTo(cardHeight/2 + maskOffset, cardWidth/2 + maskOffset);
                backCtx.closePath();
                backCtx.fill();
                
                backCtx.restore();
              } else {
                const fullWidth = box.x1 - box.x0;
                const fullHeight = box.y1 - box.y0;
                
                backCtx.save();
                backCtx.translate(box.x0 + fullWidth/2, box.y0 + fullHeight/2);
                backCtx.rotate(Math.PI / 2);
                backCtx.drawImage(img, -fullHeight/2, -fullWidth/2, fullHeight, fullWidth);
                backCtx.restore();
              }
              
              console.log(`Sheet${pageIndex + 1} Back: Inserted ${card.name} back`);
              resolve();
            };
            
            img.onerror = () => {
              console.error(`Failed to load back image for ${card.name}`);
              resolve();
            };
            
            let imageUrl: string | undefined;
            if (card.customBackImage) {
              imageUrl = card.customBackImage;
            } else if (card.cardData) {
              imageUrl = getCardImage(card.cardData, 1); // Face 1 = back
            }
            
            if (imageUrl) {
              img.src = imageUrl;
            } else {
              console.warn(`No back image URL found for ${card.name}`);
              resolve();
            }
          } else {
            // For single-sided cards, use universal back if available, otherwise draw default back
            if (universalBackImage) {
              const backImg = new Image();
              backImg.crossOrigin = 'anonymous';
              backImg.src = universalBackImage;

              backImg.onload = () => {
                const shouldAddBorder = card.addBlackBorderBack !== undefined ? card.addBlackBorderBack : true;
                
                if (shouldAddBorder) {
                  const borderSize = 37.5;
                  const cardWidth = (box.x1 - box.x0) - (2 * borderSize);
                  const cardHeight = (box.y1 - box.y0) - (2 * borderSize);
                  const fullWidth = box.x1 - box.x0;
                  const fullHeight = box.y1 - box.y0;

                  backCtx.save();
                  backCtx.translate(box.x0 + fullWidth / 2, box.y0 + fullHeight / 2);
                  backCtx.rotate(Math.PI / 2);
                  backCtx.rotate(Math.PI);
                  backCtx.fillStyle = 'black';
                  backCtx.fillRect(-fullHeight / 2, -fullWidth / 2, fullHeight, fullWidth);
                  backCtx.drawImage(backImg, -cardHeight / 2, -cardWidth / 2, cardHeight, cardWidth);
                  backCtx.restore();
                } else {
                  const fullWidth = box.x1 - box.x0;
                  const fullHeight = box.y1 - box.y0;
                  backCtx.save();
                  backCtx.translate(box.x0 + fullWidth / 2, box.y0 + fullHeight / 2);
                  backCtx.rotate(Math.PI / 2);
                  backCtx.rotate(Math.PI);
                  backCtx.drawImage(backImg, -fullHeight / 2, -fullWidth / 2, fullHeight, fullWidth);
                  backCtx.restore();
                }

                console.log(`Sheet${pageIndex + 1} Back: Universal back for ${card.name}`);
                resolve();
              };

              backImg.onerror = () => {
                console.error(`Failed to load universal back image`);
                resolve();
              };
            } else {
              const defaultImg = new Image();
              defaultImg.crossOrigin = 'anonymous';
              defaultImg.src = '/defaultBack.jpg';

              defaultImg.onload = () => {
                const fullWidth = box.x1 - box.x0;
                const fullHeight = box.y1 - box.y0;

                backCtx.save();
                backCtx.translate(box.x0 + fullWidth / 2, box.y0 + fullHeight / 2);
                backCtx.rotate(Math.PI / 2);
                backCtx.rotate(Math.PI);
                backCtx.drawImage(defaultImg, -fullHeight / 2, -fullWidth / 2, fullHeight, fullWidth);
                backCtx.restore();

                console.log(`Sheet${pageIndex + 1} Back: Default stored back for ${card.name}`);
                resolve();
              };

              defaultImg.onerror = () => {
                console.error(`Failed to load default back image`);
                resolve();
              };
            }
          }
        });
      });
      
      await Promise.all(backImagePromises);
      
      await compressCanvas(backCanvas, `Sheet${pageIndex + 1}_Back.jpg`);
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log("✅ All sheets created successfully.");
  };

  //handle form input changes
  const handleFormChange = (field: string, value: any) => {
    setNewCardForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  //Handle image upload in the popup
  const handlePopupImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check if it's an image
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
      }
      
      // Check file size (limit to 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('Image file too large. Please select a file under 10MB.');
        return;
      }
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setNewCardForm(prev => ({
          ...prev,
          uploadedImage: e.target?.result as string,
          imageFile: file
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  //Handle back image upload in the popup
  const handlePopupBackImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check if it's an image
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
      }
      
      // Check file size (limit to 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('Image file too large. Please select a file under 10MB.');
        return;
      }
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setNewCardForm(prev => ({
          ...prev,
          uploadedBackImage: e.target?.result as string,
          backImageFile: file
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  //clear the uploaded image in the popup
  const clearPopupImage = () => {
    setNewCardForm(prev => ({
      ...prev,
      uploadedImage: null,
      imageFile: null
    }));
  };

  //clear the uploaded back image in the popup
  const clearPopupBackImage = () => {
    setNewCardForm(prev => ({
      ...prev,
      uploadedBackImage: null,
      backImageFile: null
    }));
  };

  //manually add a card
  const addManualCard = async () => {
    if (!newCardForm.name.trim()) {
      alert('Please enter a card name.');
      return;
    }

    // Validate double-sided card requirements
    if (newCardForm.isDoubleSided) {
      if (!newCardForm.backFaceName.trim()) {
        alert('Please enter a back face name for double-sided cards.');
        return;
      }
      if (newCardForm.uploadedImage && !newCardForm.uploadedBackImage) {
        alert('Please upload both front and back face images for double-sided cards.');
        return;
      }
    }

    // Create the card data structure
    const newCards: DeckCard[] = [];
    for (let i = 0; i < newCardForm.quantity; i++) {
      newCards.push({
        quantity: 1,
        name: newCardForm.name,
        set: newCardForm.set || undefined,
        collectorNumber: newCardForm.collectorNumber || undefined,
        loading: !newCardForm.uploadedImage,
        currentFaceIndex: 0,
        uniqueId: `${newCardForm.name}-${newCardForm.set || ''}-${newCardForm.collectorNumber || ''}-${Date.now()}-${i}-${Math.random()}`,
        // Add custom properties for manual cards
        addBlackBorder: newCardForm.addBlackBorder,
        isDoubleSided: newCardForm.isDoubleSided,
        backFaceName: newCardForm.backFaceName || undefined,
        // Store both uploaded images
        customImage: newCardForm.uploadedImage || undefined,
        customBackImage: newCardForm.uploadedBackImage || undefined,
        isCustomCard: !!(newCardForm.uploadedImage || newCardForm.uploadedBackImage)
      });
    }

    // Add to existing cards
    setCards(prevCards => [...prevCards, ...newCards]);

    // Only fetch Scryfall data if no custom image was uploaded
    if (!newCardForm.uploadedImage) {
      // Fetch card data from Scryfall
      const cardData = await fetchCard(
        newCardForm.name,
        newCardForm.set || undefined,
        newCardForm.collectorNumber || undefined
      );

      // Update cards with fetched data
      setCards(prevCards => 
        prevCards.map(card => {
          const isNewCard = newCards.some(nc => nc.uniqueId === card.uniqueId);
          if (isNewCard) {
            if (cardData) {
              return {
                ...card,
                cardData,
                loading: false
              };
            } else {
              return {
                ...card,
                error: `Card "${newCardForm.name}" not found`,
                loading: false
              };
            }
          }
          return card;
        })
      );
    } else {
      // For custom images, mark as loaded immediately
      setCards(prevCards => 
        prevCards.map(card => {
          const isNewCard = newCards.some(nc => nc.uniqueId === card.uniqueId);
          if (isNewCard) {
            return {
              ...card,
              loading: false
            };
          }
          return card;
        })
      );
    }

    // Reset form and close popup
    setNewCardForm({
      name: '',
      quantity: 1,
      set: '',
      collectorNumber: '',
      addBlackBorder: true,
      isDoubleSided: false,
      backFaceName: '',
      uploadedImage: null,
      imageFile: null,
      uploadedBackImage: null,
      backImageFile: null
    });
    setShowAddCardPopup(false);
  };

  //add universal cardback
  const handleUniversalBackUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) {
        alert('Image file too large. Please select a file under 10MB.');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setUniversalBackImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearUniversalBackImage = () => {
    setUniversalBackImage(null);
  };

// --------------------------- JSX RENDERING ---------------------------
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #581c87 0%, #1e3a8a 50%, #312e81 100%)',
      padding: '32px',
      margin: 0,
      boxSizing: 'border-box',
      overflowY: 'auto'
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <h1 style={{
          fontSize: '2.25rem',
          fontWeight: 'bold',
          color: 'white',
          textAlign: 'center',
          marginBottom: '32px'
        }}>
          MTG Proxy Maker
        </h1>
        
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(12px)',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '32px'
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            color: 'white',
            marginBottom: '16px'
          }}>Enter your decklist:</h2>
          <textarea
            value={decklistInput}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDecklistInput(e.target.value)}
            placeholder="Enter cards like:&#10;1 Lightning Bolt&#10;2 Island&#10;4 Counterspell&#10;1 Meren of Clan Nel Toth (CMM) 346&#10;1x Black Lotus (LEA) 232"
            style={{
              width: '100%',
              height: '128px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              outline: 'none',
              resize: 'none',
              fontSize: '14px'
            }}
          />
          
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button
              onClick={loadDecklist}
              disabled={loadingAll || !decklistInput.trim()}
              style={{
                padding: '8px 24px',
                backgroundColor: loadingAll || !decklistInput.trim() ? '#6b7280' : '#2563eb',
                color: 'white',
                fontWeight: '500',
                borderRadius: '8px',
                border: 'none',
                cursor: loadingAll || !decklistInput.trim() ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => {
                if (!loadingAll && decklistInput.trim()) {
                  e.currentTarget.style.backgroundColor = '#1d4ed8';
                }
              }}
              onMouseOut={(e) => {
                if (!loadingAll && decklistInput.trim()) {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                }
              }}
            >
              {loadingAll ? 'Loading Cards...' : 'Add Cards'}
            </button>
            <button
              onClick={() => setShowAddCardPopup(true)}
              style={{
                padding: '8px 24px',
                backgroundColor: '#7c3aed',
                color: 'white',
                fontWeight: '500',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#6d28d9'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#7c3aed'}
            >
              + Add Custom Card
            </button>
            <button
              onClick={() => setShowUniversalBackPopup(true)}
              style={{
                padding: '8px 24px',
                backgroundColor: '#059669',
                color: 'white',
                fontWeight: '500',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#047857'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#059669'}
            >
              {universalBackImage ? '✓ Custom Back Set' : '+ Set Card Back'}
            </button>
            
            {cards.length > 0 && (
              <>
                <button
                  onClick={exportCardsAsImages}
                  style={{
                    padding: '8px 24px',
                    backgroundColor: '#059669',
                    color: 'white',
                    fontWeight: '500',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#047857'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                >
                  Export as JPGs
                </button>
                <button
                  onClick={clearDecklist}
                  style={{
                    padding: '8px 24px',
                    backgroundColor: '#dc2626',
                    color: 'white',
                    fontWeight: '500',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                >
                  Clear
                </button>
              </>
            )}
          </div>

          {cards.length > 0 && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '6px',
              color: '#d1d5db',
              fontSize: '14px'
            }}>
              💡 <strong>Tip:</strong> Drag and drop cards to rearrange your decklist! Click "View" to see enlarged card images and "Remove" to remove cards.
            </div>
          )}
        </div>

        {cards.length > 0 && (
          <div>
            {cards.map((card, index) => (
              <React.Fragment key={card.uniqueId}>
                {index > 0 && index % 18 === 0 && (
                  <div style={{
                    gridColumn: '1 / -1',
                    textAlign: 'center',
                    padding: '20px 0',
                    color: '#d1d5db',
                    fontSize: '14px',
                    borderTop: '1px dashed rgba(255, 255, 255, 0.3)',
                    borderBottom: '1px dashed rgba(255, 255, 255, 0.3)',
                    margin: '16px 0',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)'
                  }}>
                    📄 Page Break
                  </div>
                )}
                
                <div 
                  draggable={!card.loading && !card.error}
                  onDragStart={(e) => handleDragStart(e, card.uniqueId)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`${draggedCard === card.uniqueId ? 'drag-preview' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(12px)',
                    borderRadius: '12px',
                    padding: '6px',
                    position: 'relative',
                    minHeight: 'auto',
                    cursor: (!card.loading && !card.error) ? 'grab' : 'default',
                    border: '1px solid transparent',
                    transition: 'all 0.2s ease',
                    userSelect: 'none',
                    maxWidth: '250px',
                    margin: '0 auto 12px auto',
                    display: 'inline-block',
                    verticalAlign: 'top',
                    width: 'calc(16.666% - 8px)',
                    marginRight: '8px'
                  }}
                  onMouseDown={(e) => {
                    if (!card.loading && !card.error) {
                      e.currentTarget.style.cursor = 'grabbing';
                    }
                  }}
                  onMouseUp={(e) => {
                    if (!card.loading && !card.error) {
                      e.currentTarget.style.cursor = 'grab';
                    }
                  }}
                >
                  
                  {card.loading && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '160px'
                    }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        border: '2px solid white',
                        borderTop: '2px solid transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        marginBottom: '2px'
                      }}></div>
                      <p style={{ color: 'white', fontSize: '14px' }}>Loading {card.name}...</p>
                    </div>
                  )}

                  {card.error && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '320px',
                      textAlign: 'center'
                    }}>
                      <div style={{ color: '#f87171', marginBottom: '8px', fontSize: '24px' }}>⚠️</div>
                      <p style={{ color: '#fca5a5', fontSize: '14px' }}>{card.error}</p>
                      <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '4px' }}>{card.name}</p>
                    </div>
                  )}

                  {card.cardData || card.isCustomCard ? (
                    <div style={{ display: 'flex', flexDirection: 'column'}}>
                      <div style={{
                        marginBottom: '12px',
                        textAlign: 'center'
                      }}>
                        <img
                          src={getCardImage(card.cardData, card.currentFaceIndex || 0, card.customImage, card.customBackImage)}
                          alt={card.cardData ? getCardName(card.cardData, card.currentFaceIndex || 0) : card.name}
                          style={{
                            width: '100%',
                            height: 'auto',
                            borderRadius: '12px',
                            boxShadow: '0 6px 15px rgba(0,0,0,0.3)',
                            pointerEvents: 'none',
                            display: 'block',
                            margin: '0 auto'
                          }}
                          draggable={false}
                        />
                        
                        {/* Show flip button for Scryfall double-sided cards OR custom double-sided cards */}
                        {((card.cardData && isDoubleSided(card.cardData)) || (card.isCustomCard && card.isDoubleSided && card.customBackImage)) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              flipCard(card.uniqueId);
                            }}
                            style={{
                              position: 'absolute',
                              top: '60px',
                              left: '120px',
                              opacity: .8,
                              width: '50px',
                              height: '50px',
                              borderRadius: '50%',
                              backgroundColor: 'rgba(0, 0, 0, 0.9)',
                              border: 'none',
                              color: 'white',
                              fontSize: '22px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.9)'}
                            title="Flip Card Face"
                          >
                            ↻
                          </button>
                        )}
                      </div>

                      <div style={{ textAlign: 'center'}}>
                        <h3 style={{
                          color: 'white',
                          fontWeight: '600',
                          fontSize: '14px',
                          marginBottom: '4px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }} title={card.cardData?.name || card.name}>
                          {card.isCustomCard && card.isDoubleSided && card.backFaceName
                            ? `${card.name} // ${card.backFaceName}`
                            : (card.cardData?.name || card.name)
                          } 
            
                          {card.isCustomCard && (
                            <span style={{ 
                              color: '#10b981', 
                              fontSize: '10px', 
                              marginLeft: '4px',
                              fontWeight: 'normal'
                            }}>
                              (Custom)
                            </span>
                          )}
                        </h3>
                        
                        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (card.cardData) {
                                openCardPopup(card.cardData);
                              } else if (card.customImage) {
                                // For custom cards, create a mock card object for the popup
                                const mockCard: ScryfallCard = {
                                  id: 'custom',
                                  name:  card.isDoubleSided && card.backFaceName ? `${card.name} // ${card.backFaceName}` : card.name,
                                  type_line: 'Custom Card',
                                  set_name: 'Custom',
                                  rarity: 'common',
                                  layout: 'normal',
                                  scryfall_uri: '',
                                  image_uris: {
                                    large: card.customImage,
                                    normal: card.customImage,
                                    small: card.customImage
                                  },
                                  customImage: card.customImage,
                                  customBackImage: card.customBackImage,
                                  isDoubleSided: card.isDoubleSided,
                                } as any;
                                openCardPopup(mockCard);
                              }
                            }}
                            style={{
                              padding: '4px 12px',
                              backgroundColor: '#ea580c',
                              color: 'white',
                              fontSize: '12px',
                              borderRadius: '4px',
                              border: 'none',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s',
                              minWidth: '60px'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#c2410c'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ea580c'}
                          >
                            View
                          </button>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCard(card.uniqueId);
                            }}
                            style={{
                              padding: '4px 12px',
                              backgroundColor: '#dc2626',
                              color: 'white',
                              fontSize: '12px',
                              borderRadius: '4px',
                              border: 'none',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s',
                              minWidth: '60px'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                            title="Remove this card"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </React.Fragment>
            ))}
          </div>
        )}

        {cards.length === 0 && !loadingAll && (
          <div style={{
            textAlign: 'center',
            color: '#d1d5db',
            marginTop: '48px'
          }}>
            <p style={{ fontSize: '18px' }}>Enter your decklist above to see your cards!</p>
            <p style={{
              fontSize: '14px',
              marginTop: '8px',
              opacity: 0.75
            }}>
              Format: quantity followed by card name<br/>
              Examples: "1 Lightning Bolt", "2x Island", "4 Counterspell", "1 Meren of Clan Nel Toth (CMM) 346"
            </p>
          </div>
        )}

        {/* Card Popup Modal */}
        {selectedCard && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000,
              padding: '20px'
            }}
            onClick={closeCardPopup}
          >
            <div 
              style={{
                position: 'relative',
                maxWidth: '90vw',
                maxHeight: '90vh'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={closeCardPopup}
                style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '-10px',
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1001
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
              >
                ×
              </button>
              {isFlippableCard(selectedCard) && (
                <button
                  onClick={() => {
                    const customCard = selectedCard as any;
                    if (customCard.id === 'custom' && customCard.isDoubleSided) {
                      // Handle custom double-sided cards
                      setSelectedCardFace((prev) => (prev + 1) % 2);
                    } else {
                      // Handle Scryfall double-sided cards
                      const maxFaces = selectedCard.card_faces?.length || 1;
                      setSelectedCardFace((prev) => (prev + 1) % maxFaces);
                    }
                  }}
                >
                  ↻
                </button>
              )}
              <img
                src={getCardImageLarge(selectedCard, selectedCardFace)}
                alt={getCardName(selectedCard, selectedCardFace)}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  borderRadius: '12px',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
                }}
              />
              {isDoubleSided(selectedCard) && (
                <div style={{ /* indicator styles */ }}>
                  {getCardName(selectedCard, selectedCardFace)} ({selectedCardFace + 1} of {selectedCard.card_faces?.length || 1})
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {showAddCardPopup && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setShowAddCardPopup(false)}
        >
          <div 
            style={{
              backgroundColor: '#1f2937',
              borderRadius: '12px',
              padding: '32px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
              border: '1px solid #374151'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <h2 style={{
                color: 'white',
                fontSize: '20px',
                fontWeight: 'bold',
                margin: 0
              }}>
                Add Card Manually
              </h2>
              <button
                onClick={() => setShowAddCardPopup(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
              >
                ×
              </button>
            </div>

            {/* Form Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Card Name */}
              <div>
                <label style={{
                  display: 'block',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '6px'
                }}>
                  Card Name *
                </label>
                <input
                  type="text"
                  value={newCardForm.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  placeholder="e.g., Lightning Bolt"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid #6b7280',
                    backgroundColor: '#374151',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Quantity and Set in same row */}
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: '1' }}>
                  <label style={{
                    display: 'block',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '500',
                    marginBottom: '6px'
                  }}>
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newCardForm.quantity}
                    onChange={(e) => handleFormChange('quantity', parseInt(e.target.value) || 1)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: '1px solid #6b7280',
                      backgroundColor: '#374151',
                      color: 'white',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>
                
                <div style={{ flex: '2' }}>
                  <label style={{
                    display: 'block',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '500',
                    marginBottom: '6px'
                  }}>
                    Set Code (optional)
                  </label>
                  <input
                    type="text"
                    value={newCardForm.set}
                    onChange={(e) => handleFormChange('set', e.target.value.toUpperCase())}
                    placeholder="e.g., CMM, LEA"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: '1px solid #6b7280',
                      backgroundColor: '#374151',
                      color: 'white',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Collector Number */}
              <div>
                <label style={{
                  display: 'block',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '6px'
                }}>
                  Collector Number (optional)
                </label>
                <input
                  type="text"
                  value={newCardForm.collectorNumber}
                  onChange={(e) => handleFormChange('collectorNumber', e.target.value)}
                  placeholder="e.g., 346, 232"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid #6b7280',
                    backgroundColor: '#374151',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Options */}
              <div style={{
                backgroundColor: '#374151',
                borderRadius: '8px',
                padding: '16px'
              }}>
                <h3 style={{
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: '500',
                  marginBottom: '12px',
                  margin: '0 0 12px 0'
                }}>
                  Export Options
                </h3>

                {/* Black Border Option */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '12px'
                }}>
                  <input
                    type="checkbox"
                    id="blackBorder"
                    checked={newCardForm.addBlackBorder}
                    onChange={(e) => handleFormChange('addBlackBorder', e.target.checked)}
                    style={{
                      marginRight: '8px',
                      width: '16px',
                      height: '16px',
                      cursor: 'pointer'
                    }}
                  />
                  <label htmlFor="blackBorder" style={{
                    color: 'white',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}>
                    Add black border when exporting
                  </label>
                </div>
                
                {/* Double-sided Option */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: newCardForm.isDoubleSided ? '12px' : '0'
                }}>
                  <input
                    type="checkbox"
                    id="doubleSided"
                    checked={newCardForm.isDoubleSided}
                    onChange={(e) => handleFormChange('isDoubleSided', e.target.checked)}
                    style={{
                      marginRight: '8px',
                      width: '16px',
                      height: '16px',
                      cursor: 'pointer'
                    }}
                  />
                  <label htmlFor="doubleSided" style={{
                    color: 'white',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}>
                    This is a double-sided card
                  </label>
                </div>
                <div style={{
                  marginBottom: '24px',
                  padding: '16px',
                  backgroundColor: '#374151',
                  borderRadius: '8px',
                  border: newCardForm.uploadedImage ? '2px solid #10b981' : '2px dashed #6b7280'
                }}>
                  {!newCardForm.uploadedImage ? (
                    <div 
                      style={{
                        textAlign: 'center',
                        padding: '20px'
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.borderColor = '#10b981';
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.style.borderColor = '#6b7280';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.borderColor = '#6b7280';
                        
                        const files = e.dataTransfer.files;
                        if (files.length > 0) {
                          const file = files[0];
                          if (file.type.startsWith('image/')) {
                            const fakeEvent = { target: { files: [file] } } as any;
                            handlePopupImageUpload(fakeEvent);
                          }
                        }
                      }}
                    >
                      <div style={{ fontSize: '32px', marginBottom: '8px', color: '#9ca3af' }}></div>
                      <p style={{ 
                        color: '#d1d5db', 
                        fontSize: '13px', 
                        marginBottom: '12px',
                        margin: '0 0 12px 0'
                      }}>
                        Upload an image of the card
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePopupImageUpload}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#4f46e5',
                          color: 'white',
                          borderRadius: '4px',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      />
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <img
                        src={newCardForm.uploadedImage}
                        alt="Card reference"
                        style={{
                          maxWidth: '200px',
                          maxHeight: '280px',
                          borderRadius: '8px',
                          marginBottom: '12px',
                          border: '1px solid #6b7280'
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={clearPopupImage}
                          style={{
                            padding: '4px 12px',
                            backgroundColor: '#dc2626',
                            color: 'white',
                            fontSize: '11px',
                            borderRadius: '4px',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          Remove Image
                        </button>
                        <label 
                          style={{
                            padding: '4px 12px',
                            backgroundColor: '#6b7280',
                            color: 'white',
                            fontSize: '11px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'inline-block'
                          }}
                        >
                          Change Image
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePopupImageUpload}
                            style={{ display: 'none' }}
                          />
                        </label>
                      </div>
                      <p style={{
                        color: '#9ca3af',
                        fontSize: '11px',
                        marginTop: '8px',
                        margin: '8px 0 0 0'
                      }}>
                        Use this image as reference while filling out the card details below
                      </p>
                    </div>
                  )}
                </div>
                {newCardForm.isDoubleSided && (
                  <div style={{
                    marginBottom: '24px',
                    padding: '16px',
                    backgroundColor: '#374151',
                    borderRadius: '8px',
                    border: newCardForm.uploadedBackImage ? '2px solid #10b981' : '2px dashed #6b7280'
                  }}>
                    <h3 style={{
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: '500',
                      marginBottom: '12px',
                      margin: '0 0 12px 0'
                    }}>
                      Back Face Image *
                    </h3>
                    
                    {!newCardForm.uploadedBackImage ? (
                      <div 
                        style={{
                          textAlign: 'center',
                          padding: '20px'
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.borderColor = '#10b981';
                        }}
                        onDragLeave={(e) => {
                          e.currentTarget.style.borderColor = '#6b7280';
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.borderColor = '#6b7280';
                          
                          const files = e.dataTransfer.files;
                          if (files.length > 0) {
                            const file = files[0];
                            if (file.type.startsWith('image/')) {
                              const fakeEvent = { target: { files: [file] } } as any;
                              handlePopupBackImageUpload(fakeEvent);
                            }
                          }
                        }}
                      >
                        <div style={{ fontSize: '32px', marginBottom: '8px', color: '#9ca3af' }}></div>
                        <p style={{ 
                          color: '#d1d5db', 
                          fontSize: '13px', 
                          marginBottom: '12px',
                          margin: '0 0 12px 0'
                        }}>
                          Upload the back face of the card
                        </p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePopupBackImageUpload}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#4f46e5',
                            color: 'white',
                            borderRadius: '4px',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        />
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center' }}>
                        <img
                          src={newCardForm.uploadedBackImage}
                          alt="Back face reference"
                          style={{
                            maxWidth: '200px',
                            maxHeight: '280px',
                            borderRadius: '8px',
                            marginBottom: '12px',
                            border: '1px solid #6b7280'
                          }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={clearPopupBackImage}
                            style={{
                              padding: '4px 12px',
                              backgroundColor: '#dc2626',
                              color: 'white',
                              fontSize: '11px',
                              borderRadius: '4px',
                              border: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            Remove Image
                          </button>
                          <label 
                            style={{
                              padding: '4px 12px',
                              backgroundColor: '#6b7280',
                              color: 'white',
                              fontSize: '11px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'inline-block'
                            }}
                          >
                            Change Image
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handlePopupBackImageUpload}
                              style={{ display: 'none' }}
                            />
                          </label>
                        </div>
                        <p style={{
                          color: '#9ca3af',
                          fontSize: '11px',
                          marginTop: '8px',
                          margin: '8px 0 0 0'
                        }}>
                          Back face image uploaded
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {/* Back Face Name */}
                {newCardForm.isDoubleSided && (
                  <div style={{ marginTop: '12px' }}>
                    <label style={{
                      display: 'block',
                      color: 'white', // Changed from '#d1d5db' to make it more prominent
                      fontSize: '14px', // Increased from 13px
                      fontWeight: '500', // Added bold
                      marginBottom: '6px'
                    }}>
                      Back Face Name *
                    </label>
                    <input
                      type="text"
                      value={newCardForm.backFaceName}
                      onChange={(e) => handleFormChange('backFaceName', e.target.value)}
                      placeholder="e.g., Werewolf form name"
                      style={{
                        width: '100%',
                        padding: '10px 12px', // Increased from 8px 12px
                        borderRadius: '6px',
                        border: '1px solid #6b7280',
                        backgroundColor: '#374151', // Changed from '#1f2937'
                        color: 'white',
                        fontSize: '14px', // Increased from 13px
                        outline: 'none'
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
                marginTop: '8px'
              }}>
                <button
                  onClick={() => setShowAddCardPopup(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '500',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                
                <button
                  onClick={addManualCard}
                  disabled={!newCardForm.name.trim()}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: (newCardForm.name.trim()  && (!newCardForm.isDoubleSided || newCardForm.backFaceName.trim()))? '#10b981' : '#6b7280',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '500',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: (newCardForm.name.trim()  && (!newCardForm.isDoubleSided || newCardForm.backFaceName.trim())) ? 'pointer' : 'not-allowed'
                  }}
                >
                  Add Card{newCardForm.quantity > 1 ? `s (${newCardForm.quantity})` : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Universal Card Back Popup */}
  {showUniversalBackPopup && (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
      onClick={() => setShowUniversalBackPopup(false)}
    >
      <div 
        style={{
          backgroundColor: '#1f2937',
          borderRadius: '12px',
          padding: '32px',
          maxWidth: '500px',
          width: '100%',
          border: '1px solid #374151'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{
            color: 'white',
            fontSize: '20px',
            fontWeight: 'bold',
            margin: 0
          }}>
            Custom Card Back
          </h2>
          <button
            onClick={() => setShowUniversalBackPopup(false)}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
          >
            ×
          </button>
        </div>

        {/* Description */}
        <p style={{
          color: '#d1d5db',
          fontSize: '14px',
          marginBottom: '24px',
          margin: '0 0 24px 0'
        }}>
          Upload a custom back design for all single-sided cards. Double-sided cards will use their own back faces.
        </p>

        {/* Upload Area */}
        <div style={{
          marginBottom: '24px',
          padding: '16px',
          backgroundColor: '#374151',
          borderRadius: '8px',
          border: universalBackImage ? '2px solid #10b981' : '2px dashed #6b7280'
        }}>
          {!universalBackImage ? (
            <div 
              style={{
                textAlign: 'center',
                padding: '20px'
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = '#10b981';
              }}
              onDragLeave={(e) => {
                e.currentTarget.style.borderColor = '#6b7280';
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = '#6b7280';
                
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                  const file = files[0];
                  if (file.type.startsWith('image/')) {
                    const fakeEvent = { target: { files: [file] } } as any;
                    handleUniversalBackUpload(fakeEvent);
                  }
                }
              }}
            >
              
              <div style={{ fontSize: '64px', marginBottom: '12px', color: '#9ca3af' }}></div>
              <input
                    type="checkbox"
                    id="blackBorder"
                    checked={newCardForm.addBlackBorder}
                    onChange={(e) => handleFormChange('addBlackBorderBack', e.target.checked)}
                    style={{
                      marginRight: '8px',
                      width: '16px',
                      height: '16px',
                      cursor: 'pointer'
                    }}
                  />
                  <label htmlFor="blackBorder" style={{
                    color: 'white',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}>
                    Add black border when exporting
                  </label>
              <p style={{ 
                color: '#d1d5db', 
                fontSize: '13px', 
                marginBottom: '12px',
                margin: '0 0 12px 0'
              }}>
                Drag & drop or click to upload
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={handleUniversalBackUpload}
                style={{ display: 'none' }}
                id="universalBackUpload"
              />
              <label
                htmlFor="universalBackUpload"
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#4f46e5',
                  color: 'white',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'inline-block'
                }}
              >
                Choose File
              </label>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <img
                src={universalBackImage}
                alt="Custom card back"
                style={{
                  maxWidth: '200px',
                  maxHeight: '280px',
                  borderRadius: '8px',
                  marginBottom: '12px',
                  border: '1px solid #6b7280'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={clearUniversalBackImage}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#dc2626',
                    color: 'white',
                    fontSize: '12px',
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Remove
                </button>
                <label 
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    fontSize: '12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'inline-block'
                  }}
                >
                  Change
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUniversalBackUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={() => setShowUniversalBackPopup(false)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6b7280',
              color: 'white',
              fontSize: '14px',
              fontWeight: '500',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {universalBackImage ? 'Done' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )}
    </div>
  );
};

export default ScryfallCardDisplay;
