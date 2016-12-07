/**
 * This grammar is a RENAMED COPY of CPLParser. It is required as
 * antlr doesn't allow base grammars to have different @header
 * sections than derived composite grammars, which prevents
 * me from putting:
 * @header {
 *	using Nexus.Client.Util.Antlr;
 * }
 * in both grammars (CPLParser, and the derived grammar).
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
parser grammar CPLImportParser;
//CPL = Conditional Pattern Language

options {
	language=CSharp3;
	output=AST;    
	ASTLabelType=CommonTree;
	superClass=AntlrParserBase;
	tokenVocab=CPLLexer;
}

@namespace {Nexus.Client.ModManagement.Scripting.XmlScript.CPL}

@members {
	/// <summary>
	/// Parses the input.
	/// </summary>
	/// <returns>The parsed input.</returns>
	public override ITree Parse()
	{
		return stmt().Tree;
	}
}

/*------------------------------------------------------------------
 * PARSER RULES
 *------------------------------------------------------------------*/

public stmt				: expr EOF!;
public expr				: (a=term -> term) (( OR term )+ -> ^(OR $a term+))?;
public term				: (a=factor -> factor) (( AND factor )+ -> ^(AND $a factor+))?;
public factor			: file_check
						| flag_check
						| game_ver_check
						| manager_ver_check
						| LB! expr RB!;
public file_check			: QUOTED_VALUE IS^ FILESTATE;
public flag_check			: FLAGNAME EQUALS^ QUOTED_VALUE;
public game_ver_check		: GAME_VERSION ATLEAST^ VERSION;
public manager_ver_check	: MANAGER_VERSION ATLEAST^ VERSION;