using System;
using Antlr.Runtime;

namespace Nexus.Client.Util.Antlr
{
	/// <summary>
	/// The base lexer for ANTRL lexers.
	/// </summary>
	/// <remarks>
	/// This extends the generated lexer in order to make error handling sane, and
	/// to make the errors friendlier.
	/// </remarks>
	public abstract class AntlrLexerBase : Lexer
	{
		private ErrorTracker m_ertErrorTracker = null;

		#region Properties

		/// <summary>
		/// Gets or sets the <see cref="ErrorTracker"/> that is being used
		/// to keep track of any lexing errors.
		/// </summary>
		/// <value>The <see cref="ErrorTracker"/> that is being used
		/// to keep track of any lexing errors.</value>
		/// <exception cref="Exception">Thrown if the ErrorTracker has not been set.</exception>
		public ErrorTracker ErrorTracker
		{
			get
			{
				if (m_ertErrorTracker == null)
					m_ertErrorTracker = new ErrorTracker();
				return m_ertErrorTracker;
			}
			set
			{
				m_ertErrorTracker = value;
			}
		}

		#endregion

		#region Constructors

		/// <summary>
		/// The default constructor.
		/// </summary>
		public AntlrLexerBase()
		{
		}

		/// <summary>
		/// A simple constructor.
		/// </summary>
		/// <param name="input">The code to lex.</param>
		/// <param name="state">The <see cref="RecognizerSharedState"/> to use.</param>
		public AntlrLexerBase(ICharStream input, RecognizerSharedState state)
			: base(input, state)
		{
		}

		#endregion

		/// <summary>
		/// Logs the given error to the <see cref="ErrorTracker"/>.
		/// </summary>
		/// <param name="tokenNames">The names of the tokens in the current language.</param>
		/// <param name="e">The error.</param>
		public override void DisplayRecognitionError(String[] tokenNames, RecognitionException e)
		{
			LanguageError lerError = new LanguageError();
			lerError.Line = e.Line - 1;
			lerError.Column = e.CharPositionInLine;
			lerError.Position = e.Index;
			lerError.End = e.Index + 1;
			lerError.Message = GetErrorMessage(e, tokenNames);
			ErrorTracker.LexerErrors.Add(lerError);
		}

		/// <summary>
		/// Reports the given error.
		/// </summary>
		/// <remarks>
		/// This ensures that the error is thrown so that our <see cref="NextToken()"/>
		/// override can handle it.
		/// </remarks>
		/// <param name="e">The error.</param>
		public override void ReportError(RecognitionException e)
		{
			base.ReportError(e);
			throw e;
		}

		/// <summary>
		/// This reads the next token from the input.
		/// </summary>
		/// <remarks>
		/// If there is a lexing error, this method inserts an error token
		/// containing the bad input, and continues lexing.
		/// </remarks>
		/// <returns>The next token in the input.</returns>
		public override IToken NextToken()
		{
			try
			{
				return base.NextToken();
			}
			catch (RecognitionException re)
			{
				if (re is NoViableAltException) { Recover(re); }
				IToken tknErrorToken = new CommonToken(input, 0,
												TokenChannels.Default,
												state.tokenStartCharIndex,
												input.Index - 1);
				tknErrorToken.Line = state.tokenStartLine;
				tknErrorToken.CharPositionInLine = state.tokenStartCharPositionInLine;
				Emit(tknErrorToken);
				return state.token;
			}
		}

		/// <summary>
		/// Generates a human-readable error message for the given error.
		/// </summary>
		/// <param name="e">The error.</param>
		/// <param name="tokenNames">The names of the tokens in the current language.</param>
		/// <returns>A human-readable error message for the given error.</returns>
		public override string GetErrorMessage(RecognitionException e, string[] tokenNames)
		{
			string msg = null;
			if (e is MismatchedTokenException)
			{
				MismatchedTokenException mte = (MismatchedTokenException)e;
				msg = String.Format("Unexpected character: '{0}'. Expecting '{1}'.", GetCharErrorDisplay(e.Character), GetCharErrorDisplay(mte.Expecting));
			}
			else if (e is NoViableAltException)
			{
				NoViableAltException nvae = (NoViableAltException)e;
				msg = String.Format("Unexpected character: '{0}'.", GetCharErrorDisplay(e.Character));
			}
			else if (e is EarlyExitException)
			{
				EarlyExitException eee = (EarlyExitException)e;
				msg = String.Format("Unexpected character: '{0}'.", GetCharErrorDisplay(e.Character));
				//msg = "required (...)+ loop did not match anything at character " + GetCharErrorDisplay(e.Character);
			}
			else if (e is MismatchedNotSetException)
			{
				MismatchedNotSetException mse = (MismatchedNotSetException)e;
				msg = String.Format("Unexpected character: '{0}'. Expecting one of {1}.", GetCharErrorDisplay(e.Character), mse.Expecting);
			}
			else if (e is MismatchedSetException)
			{
				MismatchedSetException mse = (MismatchedSetException)e;
				msg = String.Format("Unexpected character: '{0}'. Expecting one of {1}.", GetCharErrorDisplay(e.Character), mse.Expecting);
			}
			else if (e is MismatchedRangeException)
			{
				MismatchedRangeException mre = (MismatchedRangeException)e;
				msg = String.Format("Unexpected character: '{0}'. Expecting one of '{1}..{2}'.", GetCharErrorDisplay(e.Character), GetCharErrorDisplay(mre.A), GetCharErrorDisplay(mre.B));
			}
			else
			{
				msg = base.GetErrorMessage(e, tokenNames);
			}
			return msg;
		}
	}
}
