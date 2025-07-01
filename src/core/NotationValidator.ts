export class NotationValidator {
  // Basic square notation (e.g., e4, a1, h8)
  static readonly SQUARE = /^[a-h][1-8]$/;

  // Piece symbols (K=King, Q=Queen, R=Rook, B=Bishop, N=Knight, no symbol=Pawn)
  static readonly PIECE = /^[KQRBNkqrbn]?/;

  // Normal piece movement (e.g., e4, Nf3, Qd1, Rxa8)
  static readonly NORMAL_MOVE = /^[KQRBNkqrbn]?[a-h]?[1-8]?x?[a-h][1-8]$/;

  // Capture notation (e.g., exd5, Nxf7, Qxd8+)
  static readonly CAPTURE = /^[KQRBNkqrbn]?[a-h]?[1-8]?x[a-h][1-8]$/;

  // Castling (O-O for kingside, O-O-O for queenside)
  static readonly KING_CASTLING = /^O-O?$/;
  static readonly QUEEN_CASTLING = /^O-O-O?$/;

  // Pawn promotion (e.g., e8=Q, axb8=N+, d1=R#)
  static readonly PROMOTION = /^[a-h][18]=[QRBN]$/;

  // Pawn promotion with capture (e.g., exf8=Q+, axb1=N#)
  static readonly PROMOTION_CAPTURE = /^[a-h]x[a-h][18]=[QRBN]$/;

  // Check notation (+ at the end)
  static readonly CHECK = /\+$/;

  // Checkmate notation (# at the end)
  static readonly CHECKMATE = /#$/;

  // Complete move with optional check/checkmate (combines all above)
  static readonly COMPLETE_MOVE = /^(?:O-O(?:-O)?|[KQRBNkqrbn]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?)[\+#]?$/;

  // Disambiguation patterns
  static readonly FILE_DISAMBIGUATION = /^[KQRBNkqrbn][a-h][a-h][1-8]$/; // e.g., Nbd2
  static readonly RANK_DISAMBIGUATION = /^[KQRBNkqrbn][1-8][a-h][1-8]$/; // e.g., N1f3
  static readonly FULL_DISAMBIGUATION = /^[KQRBNkqrbn][a-h][1-8][a-h][1-8]$/; // e.g., Nb1d2

  // En passant (special pawn capture)
  static readonly EN_PASSANT = /^[a-h]x[a-h][36]( e\.p\.)?$/;

  // Comprehensive pattern that matches most standard algebraic notation
  static readonly ALGEBRAIC_NOTATION = /^(?:O-O(?:-O)?|[KQRBNkqrbn]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?)[\+#]?(?:\s+e\.p\.)?$/;

  static isValidMove(notation: string): boolean {
    return this.ALGEBRAIC_NOTATION.test(notation.trim());
  }

  static getMoveType(notation: string): string {
    const move = notation.trim();
    
    if (this.KING_CASTLING.test(move.replace(/[\+#]/, ''))) {
      return 'king_castling';
    }

    if(this.QUEEN_CASTLING.test(move.replace(/[\+#]/, ''))) {
      return 'queen_castling';
    }
    
    if (move.includes('x')) {
      if (move.includes('=')) {
        return 'promotion_capture';
      }
      if (move.includes('e.p.')) {
        return 'en_passant';
      }
      return 'capture';
    }
    
    if (move.includes('=')) {
      return 'promotion';
    }
    
    return 'normal';
  }

  static isCheck(notation: string): boolean {
    return this.CHECK.test(notation);
  }

  static isCheckmate(notation: string): boolean {
    return this.CHECKMATE.test(notation);
  }

  static getDestinationSquare(notation: string): string | null {
    // Remove check/checkmate symbols and promotion
    const cleanMove = notation.replace(/[\+#].*$/, '').replace(/=[QRBN]/, '');
    
    // Handle castling
    if (this.KING_CASTLING.test(cleanMove)) {
      return null; // Castling doesn't have a single destination square
    }
    
    // Extract the destination square (last two characters that match square pattern)
    const match = cleanMove.match(/[a-h][1-8]$/);
    return match ? match[0] : null;
  }

  static getPieceSymbol(notation: string): string | null {
    const match = notation.match(this.PIECE);

    return match ? match[0].toUpperCase() : null;
  }
}