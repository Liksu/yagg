import { ColorHelpers } from "./color-helpers"

let initialPalette = []

if (figma.currentPage.selection.length) {
    function traverse(node) {
        const isText = node.type === 'TEXT'
        if ("children" in node) {
            for (const child of node.children) {
                traverse(child)
            }
        } else if (!isText) {
            const color = node.fills.length && node.fills[0].color
            if (color) {
                const hex = [color.r, color.g, color.b].map(n => Math.round(255 * n).toString(16).padStart(2, '0').toUpperCase()).join('')
                initialPalette.push(`#${hex}`)
            }
        }
    }

    figma.currentPage.selection.forEach(traverse)
}

initialPalette = initialPalette
    .filter((color, i, arr) => arr.indexOf(color) >= i)
    .sort((a, b) => {
        const hslA = ColorHelpers.RGBaToHSL(ColorHelpers.hexToRGBa(a))
        const hslB = ColorHelpers.RGBaToHSL(ColorHelpers.hexToRGBa(b))
        return (hslA.h - hslB.h) * 10000 + (hslA.l - hslB.l) * 100 + (hslA.s - hslB.s)
    })

figma.loadFontAsync({ family: "Inter", style: "Regular" }).then(() => {
    figma.showUI(__html__, {width: 300, height: 400, themeColors: true});
    figma.ui.postMessage(initialPalette)
})

figma.ui.onmessage = ({count, palette, targetL, showHex, type, useRGB}) => {
    if (type === 'create-gradient' && count > 0 && palette.length > 0) {
        const gradient = palette.length === 1
            ? ColorHelpers.getOneColorGradient(palette[0], count, targetL)
            : palette.length === 2
                ? ColorHelpers.getTwoColorsGradient(palette, count, useRGB)
                : ColorHelpers.getGradient(palette, count, useRGB)

        const nodes: SceneNode[] = gradient.map((c, i) => {
            const rect = figma.createRectangle()
            rect.x = i * 120
            rect.fills = [{type: 'SOLID', color: c.rgb}]
            figma.currentPage.appendChild(rect)

            if (showHex) {
                const text = figma.createText()
                text.characters = c.hex
                text.x = i * 120 + 94 - text.width
                text.y = 94 - text.height
                text.fills = [{type: 'SOLID', color: ColorHelpers.getOppositeL(c.rgb)}]

                figma.currentPage.appendChild(text)
                return figma.group([rect, text], figma.currentPage)
            }

            return rect
        });

        figma.group(nodes, figma.currentPage)
        figma.currentPage.selection = nodes
        figma.viewport.scrollAndZoomIntoView(nodes)
    }

    figma.closePlugin();
};
