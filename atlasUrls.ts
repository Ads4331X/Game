/** Vite-resolved URLs so atlas JSON always pairs with the correct PNG (dev + build). */
export const Atlas = {
    ryu: {
        image: new URL("./assets/fighters/Ryu.png", import.meta.url).href,
        json: new URL("./assets/fighters/Ryu.json", import.meta.url).href,
    },
    chunLi: {
        image: new URL("./assets/fighters/chunLi.png", import.meta.url).href,
        json: new URL("./assets/fighters/chunLi.json", import.meta.url).href,
    },
    ken: {
        image: new URL("./assets/fighters/ken.png", import.meta.url).href,
        json: new URL("./assets/fighters/ken.json", import.meta.url).href,
    },
} as const;

export const homeBg = new URL("./assets/bg.jpg", import.meta.url).href;
