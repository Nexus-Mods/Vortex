using System;
using Antlr.Runtime;
using Antlr.Runtime.Tree;

namespace Nexus.Client.Util.Antlr
{
	/// <summary>
	/// The base parser for ANTLR parsers.
	/// </summary>
	/// <remarks>
	/// This extends the generated parser in order to make error handling sane, and
	/// to make the errors friendlier.
	/// </remarks>
	public abstract class AntlrParserBase : Parser
	{
		private ErrorTracker m_ertErrorTracker = null;

		#region Properties

		/// <summary>
		/// Gets or sets the <see cref="ErrorTracker"/> that is being used
		/// to keep track of any parse errors.
		/// </summary>
		/// <value>The <see cref="ErrorTracker"/> that is being used
		/// to keep track of any parse errors.</value>
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
		/// A simple constructor.
		/// </summary>
		/// <param name="input">The token stream to parse.</param>
		/// <param name="state">The <see cref="RecognizerSharedState"/> to use.</param>
		public AntlrParserBase(ITokenStream input, RecognizerSharedState state)
			: base(input, state)
		{
		}

		#endregion

		/// <summary>
		/// Parses the input.
		/// </summary>
		/// <returns>The parsed input.</returns>
		public abstract ITree Parse();

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
			lerError.Position = e.Token.StartIndex;
			lerError.End = e.Token.StopIndex;
			lerError.Message = GetErrorMessage(e, tokenNames);
			ErrorTracker.ParserErrors.Add(lerError);
		}

		/// <summary>
		/// Generates a human-readable error message for the given error.
		/// </summary>
		/// <param name="e">The error.</param>
		/// <param name="tokenNames">The names of the tokens in the current language.</param>
		/// <returns>A human-readable error message for the given error.</returns>
		public override string GetErrorMessage(RecognitionException e, string[] tokenNames)
		{
			string msg = e.Message;
			if (e is UnwantedTokenException)
			{
				UnwantedTokenException ute = (UnwantedTokenException)e;
				string tokenName = "<unknown>";
				if (ute.Expecting == TokenTypes.EndOfFile)
					tokenName = null;
				else
					tokenName = tokenNames[ute.Expecting];
				msg = String.Format("Extraneous input: '{0}'.", GetTokenErrorDisplay(ute.UnexpectedToken));
				if (!String.IsNullOrEmpty(tokenName))
					msg += String.Format(" Expecting: '{0}'.", tokenName);
			}
			else if (e is MissingTokenException)
			{
				MissingTokenException mte = (MissingTokenException)e;
				string tokenName = "<unknown>";
				if (mte.Expecting == TokenTypes.EndOfFile)
					tokenName = null;
				else
					tokenName = tokenNames[mte.Expecting];
				if (!String.IsNullOrEmpty(tokenName))
					msg = String.Format("Missing '{0}' at '{1}'.", tokenName, GetTokenErrorDisplay(e.Token));
				else
					msg = String.Format("Extraneous input: '{0}'.", GetTokenErrorDisplay(e.Token));
			}
			else if (e is MismatchedTokenException)
			{
				MismatchedTokenException mte = (MismatchedTokenException)e;
				string tokenName = "<unknown>";
				if (mte.Expecting == TokenTypes.EndOfFile)
					tokenName = null;
				else
					tokenName = tokenNames[mte.Expecting];
				msg = String.Format("Unexpected input: '{0}'.", GetTokenErrorDisplay(e.Token));
				if (!String.IsNullOrEmpty(tokenName))
					msg += String.Format(" Expecting: '{0}'.", tokenName);
			}
			else if (e is MismatchedTreeNodeException)
			{
				MismatchedTreeNodeException mtne = (MismatchedTreeNodeException)e;
				string tokenName = "<unknown>";
				if (mtne.Expecting == TokenTypes.EndOfFile)
					tokenName = null;
				else
					tokenName = tokenNames[mtne.Expecting];
				// workaround for a .NET framework bug (NullReferenceException)
				string nodeText = (mtne.Node != null) ? mtne.Node.ToString() ?? string.Empty : string.Empty;
				msg = String.Format("Unexpected input: '{0}'.", nodeText);
				if (!String.IsNullOrEmpty(tokenName))
					msg += String.Format(" Expecting: '{0}'.", tokenName);
			}
			else if (e is NoViableAltException)
			{
				//msg = "no viable alternative at input " + GetTokenErrorDisplay(e.Token);
				msg = String.Format("Unexpected input: '{0}'.", GetTokenErrorDisplay(e.Token));
			}
			else if (e is EarlyExitException)
			{
				//msg = "required (...)+ loop did not match anything at input " +	GetTokenErrorDisplay(e.Token);
				msg = String.Format("Unexpected input: '{0}'.", GetTokenErrorDisplay(e.Token));
			}
			else if (e is MismatchedSetException)
			{
				MismatchedSetException mse = (MismatchedSetException)e;
				msg = String.Format("Unexpected input: '{0}'. Expecting one of: {1}", GetTokenErrorDisplay(e.Token), mse.Expecting);
			}
			else if (e is MismatchedNotSetException)
			{
				MismatchedNotSetException mse = (MismatchedNotSetException)e;
				msg = String.Format("Unexpected input: '{0}'. Expecting one of: {1}", GetTokenErrorDisplay(e.Token), mse.Expecting);
			}
			else if (e is FailedPredicateException)
			{
				FailedPredicateException fpe = (FailedPredicateException)e;
				msg = "rule " + fpe.RuleName + " failed predicate: {" +
					fpe.PredicateText + "}?";
			}
			return msg;
		}
	}
}
