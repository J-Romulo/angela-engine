import { Board } from "../board/Board"

export type Position = {
    column: number,
    row: number
}

export type LastPosition = Position & {
    round: number
}

export type Movement = Position & {
    type: 'move' 
    | 'capture' 
    | 'en_passant' 
    | 'king_castling' 
    | 'queen_castling' 
    | 'promotion' 
    | 'file_disambiguation' 
    | 'rank_disambiguation' 
    | 'full_disambiguation' 
    | 'promotion_capture'

    check?: boolean
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

    move(newPosition: Position, round: number, falseMove = false) {
        if(!falseMove) {
            this.lastPosition = { ...this.position, round }
            this.calculateMovementsMade(this.position, newPosition)
        }
        this.position = newPosition
    }

    abstract validMovements(board: Board, checkKingInCheck?: boolean): Movement[] | undefined
    abstract searchForCheck(board: Board, position?: { row: number, column: number }): boolean

    calculateMovementsMade(oldPosition: Position, newPosition: Position) {
        this.movementsMade += Math.abs(oldPosition.row - newPosition.row) + Math.abs(oldPosition.column - newPosition.column);
    }
}