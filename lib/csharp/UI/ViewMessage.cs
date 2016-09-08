namespace UI
{
	/// <summary>
	/// Describes a message to be displayed to the user.
	/// </summary>
	public class ViewMessage
	{
		#region Properties

		/// <summary>
		/// Gets the message to display.
		/// </summary>
		/// <value>The message to display.</value>
		public string Message { get; private set; }

		/// <summary>
		/// Gets the details to display.
		/// </summary>
		/// <value>The details to display.</value>
		public string Details { get; private set; }

		/// <summary>
		/// Gets the title of the message.
		/// </summary>
		/// <value>The title of the message.</value>
		public string Title { get; private set; }

		/// <summary>
		/// Gets the set of choices to offer the user.
		/// </summary>
		/// <value>The set of choices to offer the user.</value>
		public ExtendedMessageBoxButtons Options { get; private set; }

		/// <summary>
		/// Gets the type, or severity, of the message.
		/// </summary>
		/// <value>The type, or severity, of the message.</value>
		public MessageBoxIcon MessageType { get; private set; }

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strMessage">The message to display.</param>
		/// <param name="p_strTitle">The title of the message.</param>
		public ViewMessage(string p_strMessage, string p_strTitle)
			: this(p_strMessage, null, p_strTitle, ExtendedMessageBoxButtons.OK, MessageBoxIcon.Information)
		{
		}

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strMessage">The message to display.</param>
		/// <param name="p_strDetails">The details to display.</param>
		/// <param name="p_strTitle">The title of the message.</param>
		public ViewMessage(string p_strMessage, string p_strDetails, string p_strTitle)
			: this(p_strMessage, p_strDetails, p_strTitle, ExtendedMessageBoxButtons.OK, MessageBoxIcon.Information)
		{
		}

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strMessage">The message to display.</param>
		/// <param name="p_strTitle">The title of the message.</param>
		/// <param name="p_mbiMessageType">The type, or severity, of the message.</param>
		public ViewMessage(string p_strMessage, string p_strTitle, MessageBoxIcon p_mbiMessageType)
			: this(p_strMessage, null, p_strTitle, ExtendedMessageBoxButtons.OK, p_mbiMessageType)
		{
		}

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strMessage">The message to display.</param>
		/// <param name="p_strDetails">The details to display.</param>
		/// <param name="p_strTitle">The title of the message.</param>
		/// <param name="p_mbiMessageType">The type, or severity, of the message.</param>
		public ViewMessage(string p_strMessage, string p_strDetails, string p_strTitle, MessageBoxIcon p_mbiMessageType)
			: this(p_strMessage, p_strDetails, p_strTitle, ExtendedMessageBoxButtons.OK, p_mbiMessageType)
		{
		}

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strMessage">The message to display.</param>
		/// <param name="p_strTitle">The title of the message.</param>
		/// <param name="p_ebbOptions">The set of choices to offer the user.</param>
		/// <param name="p_mbiMessageType">The type, or severity, of the message.</param>
		public ViewMessage(string p_strMessage, string p_strTitle, ExtendedMessageBoxButtons p_ebbOptions, MessageBoxIcon p_mbiMessageType)
			: this(p_strMessage, null, p_strTitle, p_ebbOptions, p_mbiMessageType)
		{
		}

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strMessage">The message to display.</param>
		/// <param name="p_strDetails">The details to display.</param>
		/// <param name="p_strTitle">The title of the message.</param>
		/// <param name="p_ebbOptions">The set of choices to offer the user.</param>
		/// <param name="p_mbiMessageType">The type, or severity, of the message.</param>
		public ViewMessage(string p_strMessage, string p_strDetails, string p_strTitle, ExtendedMessageBoxButtons p_ebbOptions, MessageBoxIcon p_mbiMessageType)
		{
			Message = p_strMessage;
			Details = p_strDetails;
			Title = p_strTitle;
			Options = p_ebbOptions;
			MessageType = p_mbiMessageType;
		}

		#endregion
	}
}
