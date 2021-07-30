import type { RectInit, EditorConfig } from './types'
import { getDefaultConfig } from './default-config'
import { insertStrAtIndex } from './utils/insert-str-at-index'

const Y_OFFSET = 5

export class Editor {
  canvas: HTMLCanvasElement = null!
  lines = ['']
  position = {
    line: 0,
    column: 0,
  }
  specialKeyState = {
    shift: false,
  }
  config: EditorConfig

  constructor(config?: Partial<EditorConfig>) {
    this.config = {
      ...getDefaultConfig(),
      ...config,
    }
  }

  deleteLine(index: number) {
    this.lines.splice(index, 1)
  }

  get fullText(): string {
    return this.lines.join('\n')
  }

  get currentLine() {
    return this.lines[this.position.line]
  }

  set currentLine(line: string) {
    this.lines[this.position.line] = line
  }

  getChar(line: number, index: number): string {
    return this.lines[line][index]
  }

  mount(el: HTMLCanvasElement) {
    this.canvas = el
    const { width, height } = el.getBoundingClientRect()
    el.width = width
    el.height = height
  }

  rect(init: RectInit) {
    const { canvas } = this
    const { fill, x, y, width, height, ctx = canvas.getContext('2d')! } = init
    ctx.fillStyle = fill ?? 'red'
    ctx.fillRect(x, y, width, height)
  }

  setFont(
    name: string,
    size: number,
    ctx: CanvasRenderingContext2D = this.canvas.getContext('2d')!
  ) {
    ctx.font = `${size}px ${name}`
  }

  /**
   * @returns a boolean indictating whether a redraw is required
   */
  handleKeypress(
    e: Pick<
      KeyboardEvent,
      'key' | 'code' | 'altKey' | 'shiftKey' | 'ctrlKey' | 'preventDefault'
    >
  ): boolean {
    // NOTE: remember to use `return` if a redraw is not required (i.e. doing
    // backspace when you are at the start of the file)
    const { position } = this
    switch (e.code) {
      case 'Backspace': {
        const { column, line } = position

        // complete start of program
        if (column === 0 && line === 0) return false

        // regularly remove character behind cursor
        if (column > 0) {
          const {
            currentLine,
            config: { tabSize },
          } = this
          if (e.ctrlKey) {
            const alpha = 'abcdefghijklmnopqrstuvwxyz'
            const alikeChars = [
              ' ',
              ')(*&^%$#@!~`{}|:"<>?[]\\;\',./_-+=',
              `${alpha}${alpha.toUpperCase()}0123456789`,
            ]
            let i = column - 1
            let group!: string
            while (i > 0) {
              const ch = currentLine[i]
              if (group === undefined) {
                group = alikeChars.find((val) => val.includes(ch))
              } else {
                if (!group.includes(ch)) {
                  i++
                  break
                }
              }

              i--
            }

            this.currentLine =
              currentLine.slice(0, i) + currentLine.slice(column)
            position.column = i
            break
          }

          // removes "tabs"
          if (
            currentLine.slice(column - tabSize, column) === ' '.repeat(tabSize)
          ) {
            this.currentLine =
              currentLine.slice(0, column - tabSize) + currentLine.slice(column)
            position.column -= tabSize
            break
          }

          this.currentLine =
            currentLine.slice(0, column - 1) + currentLine.slice(column)
          position.column--
          break
        }

        // cursor at start of line - append current line to next one
        const oldText = this.currentLine
        const prevLine = this.lines[position.line - 1]
        this.deleteLine(line)
        position.line--
        this.currentLine += oldText
        position.column = prevLine.length
        break
      }
      case 'Delete': {
        const { column, line } = position
        const lineText = this.currentLine

        // end of line
        if (column === lineText.length) {
          const { lines } = this

          // end of last line - do nothing
          if (line === lines.length - 1) return false

          // append next line to this one
          const nextLineIdx = position.line + 1
          const nextLineText = lines[nextLineIdx]
          this.deleteLine(nextLineIdx)
          this.currentLine += nextLineText
          break
        }

        // regularly remove text within the same line
        this.currentLine =
          lineText.slice(0, column) + lineText.slice(column + 1)
        break
      }
      case 'ArrowUp': {
        if (e.altKey && e.shiftKey) {
          const { lines, currentLine } = this
          lines.splice(position.line, 0, currentLine)
          break
        }

        // can't go up
        if (position.line === 0) {
          position.column = 0
          break
        }
        // move up w/o going into ghost characters by choosing smallest
        position.line--
        position.column = Math.min(position.column, this.currentLine.length)
        break
      }
      case 'ArrowDown': {
        const { lines, currentLine } = this
        if (e.altKey && e.shiftKey) {
          lines.splice(position.line + 1, 0, currentLine)
        }

        if (position.line === lines.length - 1) {
          // can't go down
          if (position.column === currentLine.length) return false
          position.column = currentLine.length
          break
        }
        position.line++
        position.column = Math.min(this.currentLine.length, position.column)
        break
      }
      case 'ArrowLeft': {
        if (position.column > 0) {
          position.column--
          break
        }
        if (position.line > 0) {
          position.line--
          position.column = this.currentLine.length
        }
        break
      }
      case 'ArrowRight':
        if (position.column < this.currentLine.length) {
          position.column++
          break
        }
        if (position.line + 1 < this.lines.length) {
          position.line++
          position.column = 0
        }
        break
      case 'Enter': {
        const { column, line } = position
        this.lines.splice(line + 1, 0, this.currentLine.slice(column))
        this.currentLine = this.currentLine.slice(0, column)
        position.line++
        position.column = 0
        break
      }
      case 'Tab': {
        e.preventDefault()

        const {
          position: { column },
          config: { tabSize },
        } = this

        this.currentLine = insertStrAtIndex(
          this.currentLine,
          column,
          ' '.repeat(tabSize)
        )
        position.column += tabSize
        break
      }
      case 'Alt':
      case 'AltLeft':
      case 'AltRight':
      case 'Control':
      case 'ControlLeft':
      case 'ControlRight':
      case 'Shift':
      case 'ShiftLeft':
      case 'ShiftRight':
        break
      default: {
        if (e.key.length > 1) {
          console.warn(`Unhandled key: ${e.key}`)
          break
        }
        const lineText = this.currentLine
        this.currentLine = insertStrAtIndex(lineText, position.column, e.key)
        this.position.column++
      }
    }
    return true
  }

  setup() {
    const { canvas } = this
    const ctx = canvas.getContext('2d')!

    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    // TODO(sno2): figure out why it won't let us use `canvas.addEventListener`
    // with `keydown`

    window.addEventListener('keydown', (e) => {
      // remember to keep all of the event handlers within a union (`||`) here
      const shouldRedraw = this.handleKeypress(e)

      if (shouldRedraw === true) {
        window.requestAnimationFrame(() => void this.draw(ctx!))
      }
    })

    this.draw(ctx!)
  }

  draw(ctx: CanvasRenderingContext2D) {
    const {
      canvas,
      config: { fontSize, fontFamily, lineHeight },
      lines,
    } = this

    this.rect({
      width: canvas.width,
      height: canvas.height,
      x: 0,
      y: 0,
      fill: 'black',
      ctx,
    })

    const xOffset = 2
    this.setFont(fontFamily, fontSize - xOffset)
    const lineNumberOffset = ctx.measureText('8888').width

    const getY = (i: number) => i * fontSize * lineHeight + Y_OFFSET

    ctx.fillStyle = '#aaa'
    for (let i = 0; i < lines.length; i++) {
      // offset for line number font size
      switch (i) {
        case this.position.line + 1:
          ctx.fillStyle = '#aaa'
          break
        case this.position.line:
          ctx.fillStyle = '#eee'
      }
      ctx.fillText((i + 1).toString(), 0, getY(i) + xOffset)
    }

    this.setFont(fontFamily, fontSize)
    ctx.fillStyle = 'white'
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], lineNumberOffset, getY(i))
    }

    // TODO(sno2): make this dynamic for sans-serif fonts
    const textSizing = ctx.measureText('D')

    this.rect({
      width: 2,
      height: fontSize + 3,
      x: textSizing.width * this.position.column + 1 + lineNumberOffset,
      y: fontSize * lineHeight * this.position.line + Y_OFFSET - 3,
      fill: 'yellow',
      ctx,
    })
  }
}
