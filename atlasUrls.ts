/** Vite-resolved URLs so atlas JSON always pairs with the correct PNG (dev + build). */
export const Atlas = {
    ryu: {
        image: new URL("./public/assets/fighters/Ryu.png", import.meta.url).href,
        json: new URL("./public/assets/fighters/Ryu.json", import.meta.url).href,
    },
    chunLi: {
        image: new URL("./public/assets/fighters/chunLi.png", import.meta.url).href,
        json: new URL("./public/assets/fighters/chunLi.json", import.meta.url).href,
    },
    ken: {
        image: new URL("./public/assets/fighters/ken.png", import.meta.url).href,
        json: new URL("./public/assets/fighters/ken.json", import.meta.url).href,
    },
} as const;

export const homeBg = new URL("./public/assets/bg.jpg", import.meta.url).href;
