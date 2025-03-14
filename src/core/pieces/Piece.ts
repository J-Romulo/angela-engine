export type position = {
    column: number,
    row: number
}

export class Piece {
    color: 'black' | 'white'
    position: position

    constructor(color: 'black' | 'white', position: position) {
        this.color = color
        this.position = position
    }
}