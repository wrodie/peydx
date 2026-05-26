<script>
  import { onMount } from 'svelte';
  import { fade, blur, fly, crossfade } from 'svelte/transition';

  export let schedule = []; 
  let currentIndex = 0;
  let currentProgram = null;
  let timer;

  // Logic to determine which transition to apply based on Payload settings
  function getTransition(type) {
    if (type === 'fade') return { fn: fade, params: { duration: 800 } };
    if (type === 'slide') return { fn: fly, params: { x: 1000, duration: 500 } };
    // 'cut' returns nothing (instant)
    return { fn: () => ({}), params: {} };
  }

  function nextSlide() {
    if (currentIndex < currentProgram.slides.length - 1) {
      currentIndex++;
    } else {
      currentIndex = 0; 
    }
    runSlideLogic();
  }

  function runSlideLogic() {
    clearTimeout(timer);
    const slide = currentProgram.slides[currentIndex];
    if (slide?.advanceMode === 'timed') {
      timer = setTimeout(nextSlide, slide.duration * 1000);
    }
  }

  // ... (updateActiveProgram and keydown logic from previous version) ...
</script>

{#if currentProgram}
  <div class="stage">
    {#key currentIndex}
      {@const slide = currentProgram.slides[currentIndex]}
      {@const t = getTransition(slide.transition)}
      
      <div 
        class="slide-wrapper" 
        in:t.fn={t.params} 
        out:t.fn={t.params}
      >
        {#if slide.blockType === 'imageBlock'}
          {@const imageSrc = slide.image.sizes?.fullHD?.filename 
            ? `/local-media/${slide.image.sizes.fullHD.filename}` 
            : `/local-media/${slide.image.filename}`}

          <img 
            src={imageSrc} 
            class="backdrop" 
            alt="" 
            aria-hidden="true" 
          />

          <img 
            src={imageSrc} 
            class="foreground" 
            alt={slide.image.alt || 'Slide'} 
          />

        {:else if slide.blockType === 'videoBlock'}
          <video 
            src="/local-media/{slide.video.filename}" 
            autoplay 
            muted 
            on:ended={() => { if(slide.advanceMode === 'onEnd') nextSlide() }}
            class="foreground"
          ></video>
        {/if}
      </div>
    {/key}
  </div>
{/if}

<style>
  .stage {
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: black; overflow: hidden;
  }
  
  .slide-wrapper {
    position: absolute; /* Stack slides for cross-fading */
    top: 0; left: 0; width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
  }

  .backdrop {
    position: absolute; width: 110%; height: 110%;
    object-fit: cover; filter: blur(30px) brightness(0.5);
    z-index: 1;
  }

  .foreground {
    position: relative; z-index: 2;
    max-width: 100%; max-height: 100%;
    object-fit: contain;
  }
</style>