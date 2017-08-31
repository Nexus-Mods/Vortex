parser grammar ModScriptParser;
//Mod Script = The custom script language used in, primariliy, OMod scripts.

options {
	language=CSharp3;
	output=AST;    
	ASTLabelType=CommonTree;
	superClass=AntlrParserBase;
	tokenVocab=ModScriptLexer;
}

@namespace {FomodInstaller.Scripting.ModScript}

@parser::header {
	//turn off warning about not needing CLSCompliant attribute
	#pragma warning disable 3021
	using FomodInstaller.Util.Antlr;
}

@members {
	/// <summary>
	/// Parses the input.
	/// </summary>
	/// <returns>The parsed input.</returns>
	public override ITree Parse()
	{
		return prog().Tree;
	}
}

/*------------------------------------------------------------------
 * PARSER RULES
 *------------------------------------------------------------------*/

prog			: block EOF!;
block			: (NEWLINE* stmt (NEWLINE+ stmt)* NEWLINE*) -> ^(BLOCK stmt+);
stmt			: (flow_ctl | func | cond | switch_stmt | for_loop);

/****
 * functions
 ****/
keyword			: GOTO|LABEL|FATALERROR|IF_NOT|IF|ELSE|ENDIF|FOR|CONTINUE|EXIT|ENDFOR|COUNT|EACH|EXECLINES|
					SELECTWITHDESCRIPTIONSANDPREVIEWS|SELECTWITHDESCRIPTIONS|SELECTWITHPREVIEW|
					SELECTMANYWITHDESCRIPTIONSANDPREVIEWS|SELECTMANYWITHDESCRIPTIONS|
					SELECTMANYWITHPREVIEW|SELECTMANY|SELECTVAR|SELECTSTRING|SELECT|CASE|DEFAULT|BREAK|
					ENDSELECT|RETURN;
arg				: (STRING_LITERAL | QUOTED_LITERAL | IDENTIFIER | VARIABLE | FUNC_NAME | keyword) ARG_SEPARATOR!?;
func			: FUNC_NAME^ arg*;

/****
 * conditionals
 ****/
cond			: (a=IF | a=IF_NOT) func
					((NEWLINE b=block			-> ^($a func $b)) (NEWLINE ELSE c=block?	-> ^($a func $b $c?))?
					|(NEWLINE ELSE c=block?)?	-> ^($a func BLOCK $c?))
					NEWLINE ENDIF;


/****
 * flow control
 ****/
flow_ctl		: BREAK | EXIT | CONTINUE | RETURN | FATALERROR | goto_cmd | label_cmd | eval_cmd;
goto_cmd		: GOTO^ FUNC_NAME;
label_cmd		: LABEL^ FUNC_NAME;
eval_cmd		: EXECLINES^ arg;

/****
 * select blocks
 ****/
switch_opt1		: arg^;
switch_opt2		: arg^ arg;
switch_opt3		: arg^ arg arg;
switch_cmd_s	: SELECT^ arg switch_opt1+;
switch_cmd_sm	: SELECTMANY^ arg switch_opt1+;
switch_cmd_smp	: SELECTMANYWITHPREVIEW^ arg switch_opt2+;
switch_cmd_smd	: SELECTMANYWITHDESCRIPTIONS^ arg switch_opt2+;
switch_cmd_smdp	: SELECTMANYWITHDESCRIPTIONSANDPREVIEWS^ arg switch_opt3+;
switch_cmd_sp	: SELECTWITHPREVIEW^ arg switch_opt2+;
switch_cmd_sd	: SELECTWITHDESCRIPTIONS^ arg switch_opt2+;
switch_cmd_sdp	: SELECTWITHDESCRIPTIONSANDPREVIEWS^ arg switch_opt3+;
switch_cmd_var	: SELECTVAR^ arg;
switch_cmd_str	: SELECTSTRING^ arg;
switch_expr		: switch_cmd_s | switch_cmd_sm | switch_cmd_smp | switch_cmd_smd | switch_cmd_smdp
					| switch_cmd_sp | switch_cmd_sd | switch_cmd_sdp | switch_cmd_var | switch_cmd_str;
switch_case		: NEWLINE (a=CASE arg+ | a=DEFAULT)
					((NEWLINE block	-> ^($a arg* block))
					|				-> ^($a arg* BLOCK));
switch_stmt		: switch_expr^ NEWLINE!* switch_case+ NEWLINE! ENDSELECT!;

/****
 * for loops
 ****/
for_cnt			: COUNT^ arg arg arg arg?;
for_func		: (FUNC_NAME a=arg b+=arg*) -> $a ^(FUNC_NAME $b*);
for_each		: EACH^ for_func;
for_cmd			: FOR^ (for_cnt | for_each);
for_loop		: for_cmd^ NEWLINE! block NEWLINE! ENDFOR!;