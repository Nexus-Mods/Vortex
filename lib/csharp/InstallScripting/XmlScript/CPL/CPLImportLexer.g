/**
 * This grammar is a RENAMED COPY of CPLLexer. It is required as
 * antlr doesn't allow base grammars to have different @header
 * sections than derived composite grammars, which prevents
 * me from putting:
 * @header {
 *	using Nexus.Client.Util.Antlr;
 * }
 * in both grammars (CPLLexer, and the derived grammar).
 * This means one of them won't compile, as the using statement is
 * required. Why antlr prevents this is not entirely clear to me,
 * though it seems that the antlr folk believe that base grammars
 * are never complete unto themselves (meaning the antlr folk don't
 * think a base grammar should ever be used without a derived grammar).
 * 
 * The work around is to creat this exact copy of the grammar, with
 * the exception that the @header block has been removed. This way,
 * derived grammars can imnport this grammar without issue.
 * I don't believe this will have any unintended side-effects, but
 * testing and use will tell.
 *
 * The last note is that this copy is not compiled or processed
 * by the compiler in this project (more precisely: the properties
 * of this file are set so that the antlr build task and MSBuild
 * ignore this file).
 */
lexer grammar CPLImportLexer;
//CPL = Conditional Pattern Language

options {
	language=CSharp3;
	superClass=AntlrLexerBase;
}

@namespace {Nexus.Client.ModManagement.Scripting.XmlScript.CPL}

@lexer::members {
	public const System.Int32 HIDDEN = TokenChannels.Hidden;
}

/*------------------------------------------------------------------
 * LEXER RULES
 *------------------------------------------------------------------*/

//lexer rules need to be ordered from bottom up
// in order to make the intergerial indentifiers assigned to them
// predictable. they need to be predictable so that the lexer and
// parser generate the same identifiers; if they don't they can't
// talk to one another. ANTLR should do this automatically, but it
// doesn't.
//bottom up means that a given token should be listed before any
// other token in which it is used.
//note, however, that token order inplies precedence. in cases
// where an input string can match more than one token, it will
// match the token listed first.

//fragments - we had to promote them to full rules
// in order to make composite grammars work
// fragments generate private methods that are
// inaccessible to delegate parsers.
public A			: 'a' | 'A';
public B			: 'b' | 'B';
public C			: 'c' | 'C';
public D			: 'd' | 'D';
public E			: 'e' | 'E';
public F			: 'f' | 'F';
public G			: 'g' | 'G';
public H			: 'h' | 'H';
public I			: 'i' | 'I';
public J			: 'j' | 'J';
public K			: 'k' | 'K';
public L			: 'l' | 'L';
public M			: 'm' | 'M';
public N			: 'n' | 'N';
public O			: 'o' | 'O';
public P			: 'p' | 'P';
public Q			: 'q' | 'Q';
public R			: 'r' | 'R';
public S			: 's' | 'S';
public T			: 't' | 'T';
public U			: 'u' | 'U';
public V			: 'v' | 'V';
public W			: 'w' | 'W';
public X			: 'x' | 'X';
public Y			: 'y' | 'Y';
public Z			: 'z' | 'Z';
//end fragments
//the following fragments aren't used in composite
// grammars, and so don't need to be changed.
fragment ACTIVE		: A C T I V E;
fragment INACTIVE	: I N A C T I V E;
fragment MISSING	: M I S S I N G;
fragment NEWLINE	: '\r\n' | '\r' | '\n';
fragment NUMBER		: '0'..'9';

QUOTED_VALUE		: '"' .+ '"';
FLAGNAME			: '$' .+ '$';
GAME_VERSION		: G A M E V E R S I O N;
MANAGER_VERSION		: M A N A G E R V E R S I O N;
FILESTATE			: ACTIVE | INACTIVE | MISSING;
VERSION				: NUMBER+ ((('.' NUMBER+)? ('.' NUMBER+))? ('.' NUMBER+))?;
OR					: 'OR';
AND					: 'AND';
IS					: I S;
ATLEAST				: '>=';
EQUALS				: '=';
LB					: '(';
RB					: ')';
WHITESPACE			: ( '\t' | ' ' | NEWLINE | '\u000C' )+ 	{ $channel = HIDDEN; } ;
