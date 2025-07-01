import { Board } from "./board/Board";
import { NotationValidator } from "./NotationValidator";
import { Movement, Piece } from "./pieces/Piece";

const notationToColumn: { [key: string]: number } = {
    'a': 0,
    'b': 1,
    'c': 2,
    'd': 3,
    'e': 4,
    'f': 5,
    'g': 6,
    'h': 7
}

export class MovementController {
    constructor(private board: Board){
        this.board = board;
    }

    executeMovement(move: string) {
        if(!NotationValidator.isValidMove(move)) {
            throw new Error('Invalid move format.');
        }

        const pieceNotation = NotationValidator.getPieceSymbol(move) ?? '';
        const [column, row] = NotationValidator.getDestinationSquare(move)?.split('') ?? [];

        const moveType = NotationValidator.getMoveType(move);

        if(moveType.includes('castling')) {
            const king = this.board.getPieces('K', this.board.turn)[0];

            const rook = this.board.getPieces('R', this.board.turn).filter(rook => {
                return (rook.position.row === king.position.row && rook.position.column === (king.position.column + (moveType === 'king_castling' ? 3 : -4)))
            })[0];

            if(!rook || !king) {
                throw new Error('Invalid castling move.');
            }

            const kingMovements = king.validMovements(this.board)?.filter(movement => movement.type === moveType);
            const rookMovements = rook.validMovements(this.board)?.filter(movement => movement.type === moveType);

            if(!kingMovements || !rookMovements || kingMovements.length === 0 || rookMovements.length === 0) {
                throw new Error('Invalid castling move.');
            }
            
            this.movePieceInTheBoard(king, { row: kingMovements[0].row, column: kingMovements[0].column });
            this.movePieceInTheBoard(rook, { row: rookMovements[0].row, column: rookMovements[0].column });

            this.board.setTurn(this.board.turn === 'white' ? 'black' : 'white');
            this.board.setRound(this.board.round + 1);

            return false
        }

        const validPieces = this.getValidPieces(pieceNotation);
        const {validMove, validPiece} = this.getValidMovement(validPieces, column, row);

        if(!validMove || !validPiece) {
            throw new Error('Invalid move for the selected piece.');
        }

        const newSquare = this.board.getSquare({ row: parseInt(row) - 1, column: notationToColumn[column] });

        if(newSquare.empty && (validMove as Movement).type === 'en_passant') {
            this.enPassantCapture(notationToColumn[column], parseInt(row) - 1);
        }

        if(validPiece) {
            this.movePieceInTheBoard(validPiece, { row: parseInt(row) - 1, column: notationToColumn[column] });
        }

        this.board.setTurn(this.board.turn === 'white' ? 'black' : 'white');
        this.board.setRound(this.board.round + 1);

        return false
    }

    checkMoveType(move: string) {
        
    }
    getValidPieces(pieceType: string) {
        const validPieces = this.board.getPieces(pieceType, this.board.turn);
        if (!validPieces) {
            throw new Error(`Invalid piece type: ${pieceType}`);
        }
        return validPieces;
    }

    getValidMovement(pieces: Piece[], column: string, row: string) {
        let validMove = null;
        let validPiece: Piece | null = null

        // Loop inside loop, WARNING
        pieces.forEach(piece => {
            const validMovements = piece.validMovements(this.board)

            if(validMovements && validMovements.length > 0) {
                validMovements.forEach(validMovement => {
                    if(validMovement.column === notationToColumn[column] && validMovement.row === parseInt(row) - 1) {
                        validMove = validMovement;
                        validPiece = piece;
                        return
                    }
                })
            }
        })

        return {
            validMove,
            validPiece
        }
    }

    enPassantCapture(column: number, row: number) {
        const enPassantCapture = this.board.getSquare({
            row: row + (this.board.turn === 'white' ? -1 : 1),
            column: column
        })

        enPassantCapture.piece = null;
        enPassantCapture.empty = true;
    }

    movePieceInTheBoard(piece: Piece, newPosition: { row: number, column: number }) {
        const oldSquare = this.board.getSquare({ row: (piece as Piece).position.row, column: (piece as Piece).position.column });
        const newSquare = this.board.getSquare({  row: newPosition.row, column: newPosition.column });
        piece.move({ row: newPosition.row, column: newPosition.column }, this.board.round);

        newSquare.piece = piece;
        newSquare.empty = false;

        oldSquare.piece = null;
        oldSquare.empty = true;
    }
}