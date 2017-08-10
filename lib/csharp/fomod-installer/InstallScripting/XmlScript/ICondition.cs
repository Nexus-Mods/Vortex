using FomodInstaller.Interface;

namespace FomodInstaller.Scripting.XmlScript
{
	/// <summary>
	/// Defines the interface for a condition.
	/// </summary>
	public interface ICondition
	{
        /// <summary>
        /// Gets whether or not the condition is fulfilled.
        /// </summary>
        /// <remarks>
        /// The condition is fulfilled if the specified <see cref="File"/> is in the
        /// specified <see cref="State"/>.
        /// </remarks>
        /// <param name="coreDelegates">The Core delegates component.</param>
        /// <returns><c>true</c> if the condition is fulfilled;
        /// <c>false</c> otherwise.</returns>
        /// <seealso cref="ICondition.GetIsFulfilled(CoreDelegates)"/>
		bool GetIsFulfilled(ConditionStateManager csmState, CoreDelegates coreDelegates);

        /// <summary>
        /// Gets a message describing whether or not the condition is fulfilled.
        /// </summary>
        /// <remarks>
        /// If the condition is fulfilled the message is "Passed." If the condition is not fulfilled the
        /// message uses the pattern:
        ///		File '&lt;file>' is not &lt;state>.
        /// </remarks>
        /// <param name="coreDelegates">The Core delegates component.</param>
        /// <returns>A message describing whether or not the condition is fulfilled.</returns>
        /// <seealso cref="ICondition.GetMessage(CoreDelegates)"/>
		string GetMessage(ConditionStateManager csmState, CoreDelegates coreDelegates);
	}
}
