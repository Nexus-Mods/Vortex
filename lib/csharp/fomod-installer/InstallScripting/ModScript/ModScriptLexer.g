lexer grammar ModScriptLexer;
//Mod Script = The custom script language used in, primariliy, OMod scripts.

options {
	language=CSharp3;
	superClass=AntlrLexerBase;
}

@namespace {FomodInstaller.Scripting.ModScript}

@lexer::header {
	//turn off warning about not needing CLSCompliant attribute
	#pragma warning disable 3021
	using FomodInstaller.Util.Antlr;
}

@lexer::members {
	public const System.Int32 HIDDEN = TokenChannels.Hidden;
}

/*------------------------------------------------------------------
 * LEXER RULES
 *------------------------------------------------------------------*/
fragment A			: 'a' | 'A';
fragment B			: 'b' | 'B';
fragment C			: 'c' | 'C';
fragment D			: 'd' | 'D';
fragment E			: 'e' | 'E';
fragment F			: 'f' | 'F';
fragment G			: 'g' | 'G';
fragment H			: 'h' | 'H';
fragment I			: 'i' | 'I';
fragment J			: 'j' | 'J';
fragment K			: 'k' | 'K';
fragment L			: 'l' | 'L';
fragment M			: 'm' | 'M';
fragment N			: 'n' | 'N';
fragment O			: 'o' | 'O';
fragment P			: 'p' | 'P';
fragment Q			: 'q' | 'Q';
fragment R			: 'r' | 'R';
fragment S			: 's' | 'S';
fragment T			: 't' | 'T';
fragment U			: 'u' | 'U';
fragment V			: 'v' | 'V';
fragment W			: 'w' | 'W';
fragment X			: 'x' | 'X';
fragment Y			: 'y' | 'Y';
fragment Z			: 'z' | 'Z';
//end fragments
//the following fragments aren't used in composite
// grammars, and so don't need to be changed.
fragment NUMBER		: '0'..'9';
fragment ALPHA_CHAR	: A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P | Q | R | S | T | U | V | W | X | Y | Z;
fragment ESC_QUOTE	: '\\"';
fragment NL_CHAR	: '\r\n' | '\r' | '\n';
fragment WS_CHAR	: '\t' | ' ' | '\u000C';

NEWLINE			: NL_CHAR;
WHITESPACE		: ( WS_CHAR )+ 	{ $channel = HIDDEN; } ;
//the block token is never meant to be matched. it is used as an imaginary token: a placeholder in the generated AST
BLOCK			: B L O C K WHITESPACE;
GOTO			: G O T O;
LABEL			: L A B E L;
FATALERROR		: F A T A L E R R O R;
IF_NOT			: I F N O T;
IF				: I F;
ELSE			: E L S E;
ENDIF			: E N D I F;
FOR				: F O R;
CONTINUE		: C O N T I N U E;
EXIT			: E X I T;
ENDFOR			: E N D F O R;
COUNT			: C O U N T;
EACH			: E A C H;
EXECLINES		: E X E C L I N E S;
SELECTWITHDESCRIPTIONSANDPREVIEWS
				: SELECTWITHDESCRIPTIONS A N D P R E V I E W S;
SELECTWITHDESCRIPTIONS
				: SELECT W I T H D E S C R I P T I O N S;
SELECTWITHPREVIEW
				: SELECT W I T H P R E V I E W;
SELECTMANYWITHDESCRIPTIONSANDPREVIEWS
				: SELECTMANYWITHDESCRIPTIONS A N D P R E V I E W S;
SELECTMANYWITHDESCRIPTIONS
				: SELECTMANY W I T H D E S C R I P T I O N S;
SELECTMANYWITHPREVIEW
				: SELECTMANY W I T H P R E V I E W;
SELECTMANY		: SELECT M A N Y;
SELECTVAR		: SELECT V A R;
SELECTSTRING	: SELECT S T R I N G;
SELECT			: S E L E C T;
CASE			: C A S E;
DEFAULT			: D E F A U L T;
BREAK			: B R E A K;
ENDSELECT		: E N D S E L E C T;
RETURN			: R E T U R N;
ARG_SEPARATOR	: ',';
QUOTED_LITERAL	: '"' (~('"' | NEWLINE) | ESC_QUOTE)* '"';
FUNC_NAME		: ALPHA_CHAR+;
IDENTIFIER		: (ALPHA_CHAR | '_' | '-' | '|' | NUMBER)+;
VARIABLE		: '%' IDENTIFIER '%';
STRING_LITERAL	: (~(WS_CHAR | NL_CHAR | ARG_SEPARATOR))+;