import { Board } from "../board/Board"

export type Position = {
    column: number,
    row: number
}

export type LastPosition = Position & {
    round: number
}

export type Movement = Position & {
    type: 'move' | 'capture' | 'en-passant' | 'king-castling' | 'queen-castling'
}
export abstract class Piece {
    color: 'black' | 'white'
    position: Position
    lastPosition?: LastPosition
    name: string
    movementsMade = 0

    constructor(color: 'black' | 'white', position: Position, name = '') {
        this.color = color
        this.position = position
        this.name = name
    }

    move(newPosition: Position, round: number) {
        this.lastPosition = { ...this.position, round }
        this.calculateMovementsMade(this.position, newPosition)
        this.position = newPosition
    }

    abstract validMovements(board: Board): Movement[] | undefined

    calculateMovementsMade(oldPosition: Position, newPosition: Position) {
        this.movementsMade += Math.abs(oldPosition.row - newPosition.row) + Math.abs(oldPosition.column - newPosition.column);
    }
}