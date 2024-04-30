/**
 * Here is the class that has a lot of colors calculations
 * The common abbreviations used:
 * HSLa - [Hue, Saturation, Lightness, alpha?] color model
 * RGBa - [Red, Green, Blue, alpha?] color model
 * Normalized value means that it represents the value in the 0..1 range
 *
 * Some parts of color converting was found on stackoverflow, all other stuff was
 * Created by Petro Borshchahivskyi, 2022
 */

export type HexColor = `#${string}`
export type InputColorsPalette = Array<HexColor>
type HSL = Record<'h' | 's' | 'l', number>
type RGBa = Array<number> // non-normalized 0..255, can be [r,g,b] or [r,g,b,a]
type nRGB = Record<'r' | 'g' | 'b', number> // normalized 0..1, {r,g,b}
type GradientItem = {rgb: nRGB, hex: HexColor}
export type Gradient = Array<GradientItem>

export class ColorHelpers {
    /**
     * This method helps to split Hue to each of RGB colors
     */
    public static hueToColor(p: number, q: number, t: number): number {
        if (t < 0) t += 1
        if (t > 1) t -= 1
        if (t < 1 / 6) return p + (q - p) * 6 * t
        if (t < 1 / 2) return q
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
        return p
    }

    /**
     * Converts given HSL object to an RGB array
     */
    public static hslToNRGB({ h, s, l }: HSL): nRGB {
        let r, g, b

        if (s === 0) {
            r = g = b = l // achromatic
        } else {
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s
            const p = 2 * l - q
            r = ColorHelpers.hueToColor(p, q, h + 1 / 3)
            g = ColorHelpers.hueToColor(p, q, h)
            b = ColorHelpers.hueToColor(p, q, h - 1 / 3)
        }

        return {r, g, b}
    }

    /**
     * Produce the array of RGB colors from passed hex RGB string
     */
    public static hexToRGBa(color: HexColor): RGBa {
        return color
            .replace('#', '')
            .match(/.{2}/g)
            .map((s) => parseInt(s, 16))
    }

    /**
     * Convert the hex RGB string to HSL object
     */
    public static RGBaToHSL(rgb: RGBa): HSL {
        const [r, g, b] = rgb.map(c => c / 255)

        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        const l = (max + min) / 2
        let h, s

        if (max === min) {
            h = s = 0 // achromatic
        } else {
            const d = max - min
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
            switch (max) {
                case r:
                    h = (g - b) / d + (g < b ? 6 : 0)
                    break
                case g:
                    h = (b - r) / d + 2
                    break
                case b:
                    h = (r - g) / d + 4
                    break
            }
            h /= 6
        }

        return { h, s, l }
    }

    /**
     * Convert the HSL object to the hex RGB string
     */
    public static hslToHex(hsl: HSL): HexColor {
        return ColorHelpers.nRGBToHex(ColorHelpers.hslToNRGB(hsl))
    }

    /**
     * Generate the hex RGB string from the RBG array
     */
    public static RGBaToHex(rgb: RGBa, normalized = true): HexColor {
        if (rgb.some((n) => n < 0 || n > (normalized ? 1 : 255))) {
            throw Error('Incorrect color range')
        }

        return (
            '#' + rgb.map((n) => (normalized ? Math.round(n * 255) : n).toString(16).padStart(2, '0')).join('')
        ).toUpperCase() as HexColor
    }

    public static nRGBToHex({r, g, b}: nRGB): HexColor {
        return ColorHelpers.RGBaToHex([r, g, b], true)
    }

    public static RGBaToNRGB(rgb: RGBa): nRGB {
        if (rgb.length > 3) {
            rgb = ColorHelpers.applyOpacity(rgb)
        }

        const [r, g, b] = rgb.map(c => c / 255)
        return {r, g, b}
    }

    public static getOppositeL({r, g, b}: nRGB): nRGB {
        const hsl = ColorHelpers.RGBaToHSL([r, g, b].map(c => c * 255))
        hsl.l = Number(hsl.l < 0.48)
        return ColorHelpers.hslToNRGB(hsl)
    }

    /**
     * Allows converting inputs like
     * '#RGB', '#RRGGBB', '#RRGBBBAA',
     * 'rgb(r, g, b)', 'rgba(r, g, b, a)',
     * 'hsl(h, s%, l%)' and 'hsla(h, s%, l%, a)'
     * to hex color string (#RRGGBB)
     * If the alpha (opacity) was in the color, the new color will be calculated according to the WHITE background
     */
    public static colorInputToNRGB(input: string): nRGB {
        let color: nRGB

        const processRGBaToNRGB = (rgb: RGBa, normalized: boolean = false): nRGB => {
            rgb = ColorHelpers.applyOpacity(rgb, normalized)

            if (rgb.length < 3) rgb.push(0, 0, 0)
            if (rgb.length > 3) rgb.splice(3)

            return ColorHelpers.RGBaToNRGB(rgb)
        }

        if (input.startsWith('#') && input.length > 7) {
            color = processRGBaToNRGB(ColorHelpers.hexToRGBa(input as HexColor).slice(0, 4))
        }

        if (input.startsWith('rgb')) {
            color = processRGBaToNRGB(ColorHelpers.extractNumbers(input))
        }

        if (input.startsWith('hsl')) {
            let [h, s, l, a] = ColorHelpers.extractNumbers(input)
            h /= 360
            s /= 100
            l /= 100

            const {r, g, b} = ColorHelpers.hslToNRGB({ h, s, l })
            color = processRGBaToNRGB([r, g, b, a], true)
        }

        if (/^#[\da-f]{3}$/i.test(input)) {
            input = input.replace(/(\w)/g, '$1$1')
            color = ColorHelpers.RGBaToNRGB(ColorHelpers.hexToRGBa(input as HexColor))
        }

        if (!/^#[\da-f]{6}$/i.test(input)) {
            throw Error('Incorrect color format')
        }

        return color
    }

    /**
     * If RGBA passed, calculates the new color like if it was drawn on WHITE background
     * else do nothing
     */
    public static applyOpacity(rgb: RGBa, normalized: boolean = false): RGBa {
        if (rgb.length === 4 && rgb[3] != null) {
            const a = rgb.pop()
            rgb = normalized
                ? rgb.map((c) => c + (1 - c) * (1 - a))
                : rgb.map((c) => c + (255 - c) * (1 - a)).map(Math.round)
        }

        return rgb
    }

    /**
     * Removes any non-digit chars and split by coma
     * internal utility function
     * @public
     */
    public static extractNumbers(colorString: string): Array<number> {
        return colorString
            .split(',')
            .map((s: string) => s.replace(/[^.0-9]/g, ''))
            .map(Number)
    }

    public static hexToGradientItem(hex: HexColor): GradientItem {
        return {
            hex,
            rgb: ColorHelpers.RGBaToNRGB(ColorHelpers.hexToRGBa(hex)),
        }
    }

    public static getHslGradient(a: HexColor, b: HexColor, length: number): Gradient {
        const hslA = ColorHelpers.RGBaToHSL(ColorHelpers.hexToRGBa(a))
        const hslB = ColorHelpers.RGBaToHSL(ColorHelpers.hexToRGBa(b))

        const stepH = (hslB.h - hslA.h) / (length - 1)
        const stepS = (hslB.s - hslA.s) / (length - 1)
        const stepL = (hslB.l - hslA.l) / (length - 1)

        return Array.from({length}, (_, i) => {
            const hsl = {h: hslA.h + stepH * i, s: hslA.s + stepS * i, l: hslA.l + stepL * i}
            return {
                rgb: ColorHelpers.hslToNRGB(hsl),
                hex: ColorHelpers.hslToHex(hsl),
            }
        })
    }

    public static getRgbGradient(a: HexColor, b: HexColor, length: number): Gradient {
        const [rA, gA, bA] = ColorHelpers.hexToRGBa(a)
        const [rB, gB, bB] = ColorHelpers.hexToRGBa(b)

        const stepR = (rB - rA) / (length - 1)
        const stepG = (gB - gA) / (length - 1)
        const stepB = (bB - bA) / (length - 1)

        console.log({stepR, stepG, stepB})

        return Array.from({ length }, (_, i) => {
            const rgb = [rA + stepR * i, gA + stepG * i, bA + stepB * i].map(n => n < 0 ? 0 : n > 255 ? 255 : Math.round(n))
            console.log({rgb, i})
            return {
                rgb: ColorHelpers.RGBaToNRGB(rgb),
                hex: ColorHelpers.RGBaToHex(rgb, false)
            }
        })
    }

    /**
     * Calculates the gradient starts from passed color to lightness or darkness
     * @param {HexColor} color - color to start gradient
     * @param {number} length - number of gradient colors including the passed color
     * @param {0|1|null} [targetL=null] - the defined value of target lightness: 1 = white, 0 = black, null - auto selection
     */
    public static getOneColorGradient(color: HexColor, length: number, targetL?: 0 | 1): Gradient {
        const hsl = ColorHelpers.RGBaToHSL(ColorHelpers.hexToRGBa(color))
        const L = targetL != null ? 1 - targetL : hsl.l
        const [start, finish, shift] = L > 0.5 ? [0, hsl.l, 1] : [hsl.l, 1, 0]
        const step = (finish - start) / length
        const ls = Array.from({ length }, (_, i) => start + step * (i + shift))
        return ls.map((l) => ({
            rgb: ColorHelpers.hslToNRGB({ h: hsl.h, s: hsl.s, l }),
            hex: ColorHelpers.hslToHex({ h: hsl.h, s: hsl.s, l }),
        }))
    }

    /**
     * Calculates the gradient between two passed colors
     * If only start color are passed, will return the one color gradient
     * @param {HexColor} a - color to start gradient
     * @param {HexColor} b - color to finish gradient
     * @param {number} length - number of gradient colors including the passed colors
     * @param {boolean} useRGB - flag to use RBG or HSL spaces to calculate gradient
     */
    public static getTwoColorsGradient([a, b]: InputColorsPalette, length: number, useRGB = false): Gradient {
        if (length === 0) return []
        if (length === 1) return [ColorHelpers.hexToGradientItem(a)]
        if (length === 2) return [ColorHelpers.hexToGradientItem(a), ColorHelpers.hexToGradientItem(b)]

        if (b == null) {
            return ColorHelpers.getOneColorGradient(a, length)
        }

        return useRGB
            ? ColorHelpers.getRgbGradient(a, b, length)
            : ColorHelpers.getHslGradient(a, b, length)
    }

    /**
     * The main public method to work with gradients
     * Prepare the gradients between each pair of colors passed into palette
     * Adjust the number of new colors according to the passed length
     * @param {InputColorsPalette} colors - the base palette to calculate the gradient
     * @param {number} length - number of gradient colors including the passed colors
     * @param {boolean} useRGB - flag to use RBG or HSL spaces to calculate gradient
     */
    public static getGradient(colors: InputColorsPalette, length: number, useRGB = false): Gradient {
        if (length === 0 || colors.length === 0) {
            return []
        }

        if (colors.length === 1) {
            return ColorHelpers.getOneColorGradient(colors[0], length)
        }

        if (colors.length >= length) {
            return colors.slice(0, length).map(c => ColorHelpers.hexToGradientItem(c))
        }

        const segmentCount = colors.length - 1
        const segments = Array.from({ length: segmentCount }, () => 2)
        let sum = colors.length
        let pointer = 0
        while (sum < length) {
            sum++
            segments[pointer]++
            pointer++
            if (pointer === segmentCount) {
                pointer = 0
            }
        }

        return segments
            .map((segmentLength, i) =>
                ColorHelpers.getTwoColorsGradient([colors[i], colors[i + 1]], segmentLength, useRGB).slice(i && 1)
            )
            .flat()
    }
}
