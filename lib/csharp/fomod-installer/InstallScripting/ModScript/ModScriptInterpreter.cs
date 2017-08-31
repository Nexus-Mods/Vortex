using System;
using System.Collections.Generic;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using Antlr.Runtime;
using Antlr.Runtime.Tree;
using FomodInstaller.Util.Antlr;

namespace FomodInstaller.Scripting.ModScript
{
	/// <summary>
	/// Interpets and executes the given Mod Script script.
	/// </summary>
	public class ModScriptInterpreter
	{
		private string m_strScript = null;
		private ModScriptInterpreterContext m_sicContext = null;
		private int m_intForLoopDepth = 0;
		private bool m_booContinueSet = false;
		private bool m_booExitSet = false;
		private int m_intSelectDepth = 0;
		private bool m_booBreakSet = false;
		private bool m_booReturnSet = false;
		private bool m_booFatalErrorSet = false;
		private bool m_booGotoSet = false;
		private string m_strGotoLabel = null;
		private bool m_booFindLabel = false;

		#region Constructors

		/// <summary>
		/// A simple construtor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_msfFunctions">The object that implements the script functions.</param>
		/// <param name="p_strScript">The script to execute.</param>
		public ModScriptInterpreter(ModScriptFunctionProxy p_msfFunctions, string p_strScript)
		{
			m_strScript = p_strScript;
			Regex rgxAllowRunOnLines = new Regex(@"^\s*AllowRunOnLines\s*$", RegexOptions.Multiline);
			if (rgxAllowRunOnLines.IsMatch(m_strScript))
			{
				m_strScript = rgxAllowRunOnLines.Replace(m_strScript, "");
				Regex rgxContinuedLines = new Regex(@"\\\s*\n", RegexOptions.Multiline);
				m_strScript = rgxContinuedLines.Replace(m_strScript, "");
			}
			m_sicContext = CreateInterpreterContext(p_msfFunctions);
		}

		/// <summary>
		/// A simple construtor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strScript">The script to execute.</param>
		public ModScriptInterpreter(string p_strScript)
		{
			m_strScript = p_strScript;
			Regex rgxAllowRunOnLines = new Regex(@"^\s*AllowRunOnLines\s*$", RegexOptions.Multiline);
			if (rgxAllowRunOnLines.IsMatch(m_strScript))
			{
				m_strScript = rgxAllowRunOnLines.Replace(m_strScript, "");
				Regex rgxContinuedLines = new Regex(@"\\\s*\n", RegexOptions.Multiline);
				m_strScript = rgxContinuedLines.Replace(m_strScript, "");
			}
		}

		#endregion

		/// <summary>
		/// Creates the context object that tracks the state of the script being executed.
		/// </summary>
		/// <param name="p_msfFunctions">The object that implements the script functions.</param>
		/// <returns>The context object to use to track the state of the script being executed.</returns>
		protected virtual ModScriptInterpreterContext CreateInterpreterContext(ModScriptFunctionProxy p_msfFunctions)
		{
			return new ModScriptInterpreterContext(p_msfFunctions);
		}

		#region Compilation

		/// <summary>
		/// Parses the given Mod Script into an AST.
		/// </summary>
		/// <param name="p_strModScriptCode">The Mod Script to compile.</param>
		/// <param name="p_booCompileTest">Whether the prograsm is just checking if the script compiles.</param>
		/// <returns>The AST built from the given Mod Script.</returns>
		private ITree GenerateAst(string p_strModScriptCode, bool p_booCompileTest)
		{
			ErrorTracker ertErrors = new ErrorTracker();
			string strCode = p_strModScriptCode;

			//unescape characters
			Regex rgxStrings = new Regex("[^\\\\](\"(\"|(.*?[^\\\\]\")))", RegexOptions.Multiline);
			MatchCollection colStrings = rgxStrings.Matches(strCode);
			Dictionary<string, string> dicProtectedStrings = new Dictionary<string, string>();
			for (Int32 i = colStrings.Count - 1; i >= 0; i--)
			{
				string strShieldText = "<SHIELD" + i + ">";
				strCode = strCode.Replace(colStrings[i].Groups[1].Value, strShieldText);
				dicProtectedStrings[strShieldText] = colStrings[i].Value;
			}
			strCode = strCode.Replace(@"\""", @"""").Replace(@"\\", @"\");
			foreach (string strKey in dicProtectedStrings.Keys)
				strCode = strCode.Replace(strKey, dicProtectedStrings[strKey]);

			//clean code
			colStrings = rgxStrings.Matches(strCode);
			dicProtectedStrings.Clear();
			for (Int32 i = colStrings.Count - 1; i >= 0; i--)
			{
				string strShieldText = "<SHIELD" + i + ">";
				strCode = strCode.Replace(colStrings[i].Value, strShieldText);
				dicProtectedStrings[strShieldText] = colStrings[i].Value;
			}

			//strip comments
			Regex rgxComments = new Regex(";.*$", RegexOptions.Multiline);
			strCode = rgxComments.Replace(strCode, "");
			foreach (string strKey in dicProtectedStrings.Keys)
				strCode = strCode.Replace(strKey, dicProtectedStrings[strKey]);

			AntlrParserBase cpbParser = CreateParser(strCode, ertErrors);
			ITree astModSCript = cpbParser.Parse();
			if ((ertErrors.HasErrors) && !p_booCompileTest)
			{
				m_sicContext.FunctionProxy.ExtendedMessageBox("Invalid Mod Script", "Error", ertErrors.ToHtml());
				return null;
			}
			return astModSCript;
		}

		/// <summary>
		/// Creates a Mod Script parser for the given code, using the given error tracker.
		/// </summary>
		/// <param name="p_strCode">The code be parsed.</param>
		/// <param name="p_ertErrorTracker">The error tracker to use to log
		/// parsing errors.</param>
		/// <returns>A Mod Script parser for the given code.</returns>
		public AntlrParserBase CreateParser(string p_strCode, ErrorTracker p_ertErrorTracker)
		{
			AntlrLexerBase lexLexer = CreateLexer(p_strCode, p_ertErrorTracker);
			CommonTokenStream ctsTokens = new CommonTokenStream(lexLexer);
			ModScriptParser prsParser = new ModScriptParser(ctsTokens);
			prsParser.ErrorTracker = p_ertErrorTracker;
			return prsParser;
		}

		/// <summary>
		/// Creates a Mod Script lexer for the given code, using the given error tracker.
		/// </summary>
		/// <param name="p_strCode">The code be lexed.</param>
		/// <param name="p_ertErrorTracker">The error tracker to use to log
		/// lexing errors.</param>
		/// <returns>A Mod Script lexer for the given code.</returns>
		public AntlrLexerBase CreateLexer(string p_strCode, ErrorTracker p_ertErrorTracker)
		{
			ModScriptLexer lexLexer = new ModScriptLexer(new ANTLRStringStream(p_strCode));
			lexLexer.ErrorTracker = p_ertErrorTracker;
			return lexLexer;
		}

		#endregion

		#region Execution

		/// <summary>
		/// Tries to compile the script.
		/// </summary>
		/// <returns><c>true</c> if the script compiled successfully;
		/// <c>false</c> otherwise.</returns>
		public bool Compile()
		{
			ITree astScript = null;
			try
			{
				astScript = GenerateAst(m_strScript, true);
			}
			catch { }
			return (astScript != null);
		}

		/// <summary>
		/// Executes the script.
		/// </summary>
		/// <returns><c>true</c> if the script completed successfully;
		/// <c>false</c> otherwise.</returns>
		public bool Execute()
		{
			ITree astScript = GenerateAst(m_strScript, false);
			if (astScript == null)
				return false;
			object objValue = Run(astScript);
			while (m_booGotoSet)
			{
				m_booGotoSet = false;
				m_booFindLabel = true;
				Run(astScript);
			}
			if (!m_booFatalErrorSet)
			{
				m_sicContext.CompleteFileInstallation();
				return true;
			}
			return false;
		}

		/// <summary>
		/// Runs the script represented by the given abstract syntax tree.
		/// </summary>
		/// <param name="p_astScript">The abstract syntax tree representation of the script to execute.</param>
		/// <returns>The return value of the script.</returns>
		protected object Run(ITree p_astScript)
		{
			return Run(p_astScript, false);
		}

		/// <summary>
		/// Runs the script represented by the given abstract syntax tree.
		/// </summary>
		/// <param name="p_astScript">The abstract syntax tree representation of the script to execute.</param>
		/// <param name="p_booTreatKeywordsAsLiterals">Whether keywords should be treated as literals instead of keywords.</param>
		/// <returns>The return value of the script.</returns>
		protected object Run(ITree p_astScript, bool p_booTreatKeywordsAsLiterals)
		{
			if (m_booFindLabel && (p_astScript.Type != ModScriptParser.LABEL) && (p_astScript.Type != ModScriptParser.BLOCK))
			{
				for (Int32 i = 0; i < p_astScript.ChildCount; i++)
				{
					Run(p_astScript.GetChild(i), p_booTreatKeywordsAsLiterals);
					if (!m_booFindLabel)
						return null;
				}
				return null;
			}
			if (p_astScript.IsNil)
			{
				//this is the script root
				for (Int32 i = 0; i < p_astScript.ChildCount; i++)
				{
					Run(p_astScript.GetChild(i));
					if (m_booReturnSet || m_booGotoSet)
						return null;
				}
			}
			Int32 intTokenType = p_booTreatKeywordsAsLiterals ? ModScriptParser.STRING_LITERAL : p_astScript.Type;
			switch (intTokenType)
			{
				case ModScriptParser.ARG_SEPARATOR:
				case ModScriptParser.CASE:
				case ModScriptParser.COUNT:
				case ModScriptParser.DEFAULT:
				case ModScriptParser.EACH:
				case ModScriptParser.ELSE:
				case ModScriptParser.ENDIF:
				case ModScriptParser.ENDFOR:
				case ModScriptParser.ENDSELECT:
				case ModScriptParser.EOF:
				case ModScriptParser.NEWLINE:
				case ModScriptParser.WHITESPACE:
					throw new Exception(String.Format("Unexpected token: {0}. We should never get here as the parser should have caught this. ({1},{2})", p_astScript.Text, p_astScript.Line, p_astScript.CharPositionInLine));
				case ModScriptParser.EXECLINES:
					ITree astNewCode = p_astScript.GetChild(0);
					string strNewCode = (string)Run(astNewCode, true);
					ITree astCompiledCode = GenerateAst(strNewCode, false);
					if (astCompiledCode == null)
					{
						m_booReturnSet = true;
						m_booFatalErrorSet = true;
					}
					else
						Run(astCompiledCode);
					return null;
				case ModScriptParser.GOTO:
					m_booGotoSet = true;
					m_strGotoLabel = (string)Run(p_astScript.GetChild(0), true);
					return null;
				case ModScriptParser.LABEL:
					if (m_booFindLabel)
					{
						m_booFindLabel = false;
						string strLabel = (string)Run(p_astScript.GetChild(0), true);
						m_booFindLabel = !m_strGotoLabel.Equals(strLabel);
					}
					return null;
				case ModScriptParser.RETURN:
					m_booReturnSet = true;
					return null;
				case ModScriptParser.FATALERROR:
					m_booReturnSet = true;
					m_booFatalErrorSet = true;
					return null;
				case ModScriptParser.BREAK:
					if (m_intSelectDepth == 0)
						throw new Exception(String.Format("Unexpected BREAK: not in SELECT statement. ({0},{1})", p_astScript.Line, p_astScript.CharPositionInLine));
					m_booBreakSet = true;
					return null;
				case ModScriptParser.CONTINUE:
					if (m_intForLoopDepth == 0)
						throw new Exception(String.Format("Unexpected CONTINUE: not in FOR loop. ({0},{1})", p_astScript.Line, p_astScript.CharPositionInLine));
					m_booContinueSet = true;
					return null;
				case ModScriptParser.EXIT:
					if (m_intForLoopDepth == 0)
						throw new Exception(String.Format("Unexpected EXIT: not in FOR loop. ({0},{1})", p_astScript.Line, p_astScript.CharPositionInLine));
					m_booExitSet = true;
					return null;
				case ModScriptParser.IDENTIFIER:
					return p_astScript.Text;
				case ModScriptParser.BLOCK:
					for (Int32 i = 0; i < p_astScript.ChildCount; i++)
					{
						Run(p_astScript.GetChild(i));
						if (m_booReturnSet || m_booContinueSet || m_booExitSet || m_booBreakSet || m_booGotoSet)
							break;
					}
					return null;
				case ModScriptParser.SELECTMANY:
				case ModScriptParser.SELECTMANYWITHDESCRIPTIONS:
				case ModScriptParser.SELECTMANYWITHDESCRIPTIONSANDPREVIEWS:
				case ModScriptParser.SELECTMANYWITHPREVIEW:
				case ModScriptParser.SELECTWITHDESCRIPTIONS:
				case ModScriptParser.SELECTWITHDESCRIPTIONSANDPREVIEWS:
				case ModScriptParser.SELECTWITHPREVIEW:
				case ModScriptParser.SELECT:
					HandleSelect(p_astScript);
					return null;
				case ModScriptParser.SELECTVAR:
				case ModScriptParser.SELECTSTRING:
					HandleSelectString(p_astScript);
					return null;
				case ModScriptParser.IF_NOT:
				case ModScriptParser.IF:
					HandleConditionalStatement(p_astScript);
					return null;
				case ModScriptParser.FOR:
					HandleForLoop(p_astScript);
					return null;
				case ModScriptParser.FUNC_NAME:
					return HandleFunction(p_astScript);
				case ModScriptParser.VARIABLE:
				case ModScriptParser.QUOTED_LITERAL:
				case ModScriptParser.STRING_LITERAL:
					return ExpandVariables(p_astScript);
			}
			return null;
		}

		#endregion

		#region Selection Statements

		/// <summary>
		/// Handles the GUI SELECT-type statements.
		/// </summary>
		/// <remarks>
		/// This methods presents a selection form to the user, and acts on the selection.
		/// </remarks>
		/// <param name="p_astSelect">The SELECT statement to process.</param>
		private void HandleSelect(ITree p_astSelect)
		{
			m_intSelectDepth++;

			string strTitle = (string)Run(p_astSelect.GetChild(0), true);
			bool booSelectMany = false;
			switch (p_astSelect.Type)
			{

				case ModScriptParser.SELECTMANY:
				case ModScriptParser.SELECTMANYWITHDESCRIPTIONS:
				case ModScriptParser.SELECTMANYWITHPREVIEW:
				case ModScriptParser.SELECTMANYWITHDESCRIPTIONSANDPREVIEWS:
					booSelectMany = true;
					break;
			}

			Int32 intCaseCounter = 1;
			List<ModScriptSelectOption> lstOptions = new List<ModScriptSelectOption>();
			bool booHasDefault = false;
			for (; intCaseCounter < p_astSelect.ChildCount; intCaseCounter++)
			{
				ITree astOption = p_astSelect.GetChild(intCaseCounter);
				if ((astOption.Type == ModScriptParser.CASE) || (astOption.Type == ModScriptParser.DEFAULT))
					break;
				string strOptionName = (string)Run(astOption, true);
				bool booIsDefault = strOptionName.StartsWith("|");
				if (booIsDefault)
				{
					booHasDefault = true;
					strOptionName = strOptionName.Substring(1);
				}
				string strParam1 = (astOption.ChildCount > 0) ? (string)Run(astOption.GetChild(0), true) : null;
				string strParam2 = (astOption.ChildCount > 1) ? (string)Run(astOption.GetChild(1), true) : null;
				switch (p_astSelect.Type)
				{
					case ModScriptParser.SELECT:
					case ModScriptParser.SELECTMANY:
						lstOptions.Add(new ModScriptSelectOption(strOptionName, booIsDefault, null, null));
						break;
					case ModScriptParser.SELECTWITHDESCRIPTIONS:
					case ModScriptParser.SELECTMANYWITHDESCRIPTIONS:
						lstOptions.Add(new ModScriptSelectOption(strOptionName, booIsDefault, strParam1, null));
						break;
					case ModScriptParser.SELECTWITHPREVIEW:
					case ModScriptParser.SELECTMANYWITHPREVIEW:
						if ("none".Equals(strParam1, StringComparison.InvariantCultureIgnoreCase))
							strParam1 = null;
						lstOptions.Add(new ModScriptSelectOption(strOptionName, booIsDefault, null, strParam1));
						break;
					case ModScriptParser.SELECTWITHDESCRIPTIONSANDPREVIEWS:
					case ModScriptParser.SELECTMANYWITHDESCRIPTIONSANDPREVIEWS:
						if ("none".Equals(strParam2, StringComparison.InvariantCultureIgnoreCase))
							strParam2 = null;
						lstOptions.Add(new ModScriptSelectOption(strOptionName, booIsDefault, strParam1, strParam2));
						break;
					default:
						throw new Exception(String.Format("Unrecognized SELECT type: {0}. We should be able to get hear, as the main Run() method shuld have found this issue. ({1},{2})", p_astSelect.Text, p_astSelect.Line, p_astSelect.CharPositionInLine));
				}
			}
			if (!booHasDefault && !booSelectMany)
				lstOptions[0].IsDefault = true;

			List<KeyValuePair<string, ITree>> lstCases = new List<KeyValuePair<string, ITree>>();
			ITree astDefaultCase = null;
			for (; intCaseCounter < p_astSelect.ChildCount; intCaseCounter++)
			{
				ITree astCase = p_astSelect.GetChild(intCaseCounter);
				switch (astCase.Type)
				{
					case ModScriptParser.CASE:
						StringBuilder stbMatchValue = new StringBuilder();
						for (Int32 j = 0; j < astCase.ChildCount - 1; j++)
						{
							stbMatchValue.Append(Run(astCase.GetChild(j), true));
							if (j < astCase.ChildCount - 2)
								stbMatchValue.Append(" ");
						}
						string strMatchValue = stbMatchValue.ToString();
						lstCases.Add(new KeyValuePair<string, ITree>(strMatchValue, astCase.GetChild(astCase.ChildCount - 1)));
						break;
					case ModScriptParser.DEFAULT:
						astDefaultCase = astCase.GetChild(0);
						break;
					default:
						throw new Exception(String.Format("Unrecognized SELECT case type: {0}. Expecting CASE or DEFAULT. ({1},{2})", astCase.Text, astCase.Line, astCase.CharPositionInLine));
				}
			}

			string[] strSelectedOptions = m_sicContext.FunctionProxy.Select(lstOptions, strTitle, booSelectMany);
			foreach (string strRawExpression in strSelectedOptions)
			{
				string strExpression = strRawExpression;
				if (strExpression != null)
				{
					Regex rgxWhitespace = new Regex(@"\s");
					strExpression = rgxWhitespace.Replace(strExpression, " ");
					Regex rgxAdjacentSpaces = new Regex(@"  +");
					strExpression = rgxAdjacentSpaces.Replace(strExpression, " ");

				}

				bool booMatched = false;
				foreach (KeyValuePair<string, ITree> kvpCase in lstCases)
				{
					//if we previously matched a CASE, but are still examining
					// CASEs, it is because there was no Break statement and we
					// fell through to the subsequent CASEs. if that is the case,
					// don't check the condition, just execute the code.
					// (when we fall through we execute subsequent blocks until
					// the next Break statement without caring about the CASE
					// conditions)
					if (booMatched || String.Equals(strExpression, kvpCase.Key))
					{
						booMatched = true;
						Run(kvpCase.Value);
						if (m_booReturnSet || m_booGotoSet)
							return;
						if (m_booBreakSet)
							break;
					}
				}
				if ((!booMatched || !m_booBreakSet) && (astDefaultCase != null))
				{
					Run(astDefaultCase);
					if (m_booReturnSet || m_booGotoSet)
						return;
				}
				m_booBreakSet = false;
			}
			if (strSelectedOptions.Length == 0)
			{
				Run(astDefaultCase);
				m_booBreakSet = false;
			}
			m_intSelectDepth--;
		}

		/// <summary>
		/// Handles the C# switch-type SELECT-type statements.
		/// </summary>
		/// <remarks>
		/// This methods processes the SELECT-type statements that behave like if...elseif statements.
		/// </remarks>
		/// <param name="p_astSelect">The SELECT statement to process.</param>
		private void HandleSelectString(ITree p_astSelect)
		{
			m_intSelectDepth++;
			string strExpression = (string)Run(p_astSelect.GetChild(0), true);
			if (p_astSelect.Type == ModScriptParser.SELECTVAR)
				strExpression = m_sicContext.GetVar(strExpression);
			if (strExpression != null)
			{
				Regex rgxWhitespace = new Regex(@"\s");
				strExpression = rgxWhitespace.Replace(strExpression, " ");
				Regex rgxAdjacentSpaces = new Regex(@"  +");
				strExpression = rgxAdjacentSpaces.Replace(strExpression, " ");

			}

			List<KeyValuePair<string, ITree>> lstCases = new List<KeyValuePair<string, ITree>>();
			ITree astDefaultCase = null;
			for (Int32 i = 1; i < p_astSelect.ChildCount; i++)
			{
				ITree astCase = p_astSelect.GetChild(i);
				switch (astCase.Type)
				{
					case ModScriptParser.CASE:
						StringBuilder stbMatchValue = new StringBuilder();
						for (Int32 j = 0; j < astCase.ChildCount - 1; j++)
						{
							stbMatchValue.Append(Run(astCase.GetChild(j), true));
							if (j < astCase.ChildCount - 2)
								stbMatchValue.Append(" ");
						}
						string strMatchValue = stbMatchValue.ToString();
						lstCases.Add(new KeyValuePair<string, ITree>(strMatchValue, astCase.GetChild(astCase.ChildCount - 1)));
						break;
					case ModScriptParser.DEFAULT:
						astDefaultCase = astCase.GetChild(0);
						break;
					default:
						throw new Exception(String.Format("Unrecognized SELECT case type: {0}. Expecting CASE or DEFAULT. ({1},{2})", astCase.Text, astCase.Line, astCase.CharPositionInLine));
				}
			}

			bool booMatched = false;
			foreach (KeyValuePair<string, ITree> kvpCase in lstCases)
			{
				//if we previously matched a CASE, but are still examining
				// CASEs, it is because there was no Break statement and we
				// fell through to the subsequent CASEs. if that is the case,
				// don't check the condition, just execute the code.
				// (when we fall through we execute subsequent blocks until
				// the next Break statement without caring about the CASE
				// conditions)
				if (booMatched || String.Equals(strExpression, kvpCase.Key))
				{
					booMatched = true;
					Run(kvpCase.Value);
					if (m_booReturnSet || m_booGotoSet)
						return;
					if (m_booBreakSet)
						break;
				}
			}
			if ((!booMatched || !m_booBreakSet) && (astDefaultCase != null))
			{
				Run(astDefaultCase);
				if (m_booReturnSet || m_booGotoSet)
					return;
			}
			m_booBreakSet = false;
			m_intSelectDepth--;
		}

		#endregion

		#region Conditional Statements

		/// <summary>
		/// Handles the IF statements.
		/// </summary>
		/// <param name="p_astConditional">The IF statement to process.</param>
		private void HandleConditionalStatement(ITree p_astConditional)
		{
			ITree astCondition = p_astConditional.GetChild(0);
			ITree astTrueBlock = p_astConditional.GetChild(1);
			ITree astFalseBlock = (p_astConditional.ChildCount > 2) ? p_astConditional.GetChild(2) : null;
			bool booConditionResult = (bool)Run(astCondition);
			if (p_astConditional.Type == ModScriptParser.IF_NOT)
				booConditionResult = !booConditionResult;
			if (booConditionResult)
				Run(astTrueBlock);
			else if (astFalseBlock != null)
				Run(astFalseBlock);
		}

		#endregion

		#region Literal Statements

		/// <summary>
		/// Expands the variables in the given literal, and strips the enclosing quotes
		/// from quoted literals.
		/// </summary>
		/// <remarks>
		/// Expanding variables replaces the variables with the values the variables represent.
		/// </remarks>
		/// <param name="p_astLiteral">The literal in which to expand the variables.</param>
		/// <returns>The expanded literal.</returns>
		private string ExpandVariables(ITree p_astLiteral)
		{
			Regex rgxVariables = new Regex("%([^%]+)%");
			string strStringLiteral = p_astLiteral.Text;
			strStringLiteral = strStringLiteral.Replace(@"\\", @"\");
			Regex rgxUnescapedQuotes = new Regex(@"^""""$|^""|([^\\])""");
			strStringLiteral = rgxUnescapedQuotes.Replace(strStringLiteral, "$1");
			MatchCollection mhcVariables = rgxVariables.Matches(strStringLiteral);
			foreach (Match mchVariable in mhcVariables)
			{
				if (mchVariable.Success)
				{
					string strVariableName = mchVariable.Groups[1].Value;
					string strValue = m_sicContext.GetVar(strVariableName);
					strStringLiteral = strStringLiteral.Replace("%" + strVariableName + "%", strValue);
				}
			}
			return strStringLiteral;
		}

		#endregion

		#region Function Calls

		/// <summary>
		/// Calss the function represented by the given abstract syntax tree.
		/// </summary>
		/// <param name="p_astFunction">The abstract syntax tree representing the function to be called.</param>
		/// <returns>The return value of the called function.</returns>
		private object HandleFunction(ITree p_astFunction)
		{
			List<Type> lstArgTypes = new List<Type>();
			List<object> lstArgs = new List<object>();
			for (Int32 i = 0; i < p_astFunction.ChildCount; i++)
			{
				object objArg = Run(p_astFunction.GetChild(i), true);
				lstArgTypes.Add(objArg.GetType());
				lstArgs.Add(objArg);
			}
			object[] objFunctionProviders = { m_sicContext, m_sicContext.FunctionProxy };
			object objFunctionProvider = null;
			MethodInfo mifFunction = null;
			foreach (object objFunctionProviderCandidate in objFunctionProviders)
			{
				mifFunction = objFunctionProviderCandidate.GetType().GetMethod(p_astFunction.Text, lstArgTypes.ToArray());
				if (mifFunction == null)
				{
					mifFunction = objFunctionProviderCandidate.GetType().GetMethod(p_astFunction.Text, new Type[] { typeof(string[]) });
					if (mifFunction != null)
					{
						List<string> lstNewArgs = new List<string>();
						lstArgs.ForEach(x => lstNewArgs.Add(x.ToString()));
						lstArgs.Clear();
						lstArgs.Add(lstNewArgs.ToArray());
						lstArgTypes.Clear();
						lstArgTypes.Add(typeof(string[]));
					}
				}
				if (mifFunction != null)
				{
					objFunctionProvider = objFunctionProviderCandidate;
					break;
				}
			}
			if (mifFunction == null)
			{
				StringBuilder stbError = new StringBuilder("Unrecognized Function: ");
				stbError.AppendFormat("{0}(", p_astFunction.Text);
				for (Int32 i = 0; i < lstArgs.Count; i++)
				{
					stbError.AppendFormat("{0} {1}", lstArgTypes[i].Name, p_astFunction.GetChild(i));
					if (i < lstArgs.Count - 1)
						stbError.Append(", ");
				}
				stbError.AppendFormat("). ({0},{1})", p_astFunction.Line, p_astFunction.CharPositionInLine);
				throw new Exception(stbError.ToString());
			}
			object objValue = mifFunction.Invoke(objFunctionProvider, lstArgs.ToArray());
			return objValue;
		}

		#endregion

		#region Loop Statements

		/// <summary>
		/// Hanldes FOR loops.
		/// </summary>
		/// <param name="p_astForLoop">The FOR loop to process.</param>
		private void HandleForLoop(ITree p_astForLoop)
		{
			ITree treForCommand = p_astForLoop.GetChild(0);
			ITree treBlock = p_astForLoop.GetChild(1);
			m_intForLoopDepth++;
			if (treForCommand.Type == ModScriptParser.COUNT)
			{
				string strCounterVariableName = (string)Run(treForCommand.GetChild(0), true);
				Int32 intStartCount = Int32.Parse((string)Run(treForCommand.GetChild(1)));
				Int32 intEndCount = Int32.Parse((string)Run(treForCommand.GetChild(2)));
				Int32 intStepSize = (treForCommand.ChildCount > 3) ? Int32.Parse((string)Run(treForCommand.GetChild(3))) : 1;
				for (Int32 i = intStartCount; i <= intEndCount; i += intStepSize)
				{
					m_sicContext.SetVar(strCounterVariableName, i.ToString());
					Run(treBlock);
					m_booContinueSet = false;
					if (m_booReturnSet || m_booGotoSet)
						return;
					if (m_booExitSet)
						break;
				}
			}
			else if (treForCommand.Type == ModScriptParser.EACH)
			{
				string strCounterVariableName = (string)Run(treForCommand.GetChild(0), true);
				IEnumerable<string> lstItems = (IEnumerable<string>)Run(treForCommand.GetChild(1));
				foreach (string strItem in lstItems)
				{
					m_sicContext.SetVar(strCounterVariableName, strItem);
					Run(treBlock);
					m_booContinueSet = false;
					if (m_booReturnSet || m_booGotoSet)
						return;
					if (m_booExitSet)
						break;
				}
			}
			else
				throw new Exception("Invalid FOR command: " + treForCommand.Text);
			m_booExitSet = false;
			m_intForLoopDepth--;
		}

		#endregion
	}
}
