parser grammar CPLParser;
//CPL = Conditional Pattern Language

options {
	language=CSharp3;
	output=AST;    
	ASTLabelType=CommonTree;
	superClass=AntlrParserBase;
	tokenVocab=CPLLexer;
}

@namespace {Nexus.Client.ModManagement.Scripting.XmlScript.CPL}

@parser::header {
	//turn off warning about not needing CLSCompliant attribute
	#pragma warning disable 3021
	using Nexus.Client.Util.Antlr;
}

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