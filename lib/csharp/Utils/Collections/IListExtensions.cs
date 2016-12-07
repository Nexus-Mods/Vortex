using System;
using System.Linq;
using System.Collections.Generic;
using System.Collections;

namespace Utils.Collections
{
	/// <summary>
	/// Extension methods for the <see cref="IList"/> interface.
	/// </summary>
	public static class IListExtensions
	{
		/// <summary>
		/// Finds the first instance in the list that matches the given predicate.
		/// </summary>
		/// <typeparam name="T">The type of object in the list.</typeparam>
		/// <param name="p_lstList">The list to search.</param>
		/// <param name="p_prdMatchPredicate">The <see cref="Predicate{T}"/> against which to match the list
		/// items.</param>
		/// <returns>The first instance in the list that matches the given predicate.</returns>
		public static T Find<T>(this IList<T> p_lstList, Predicate<T> p_prdMatchPredicate)
		{
			foreach (T tItem in p_lstList)
				if (p_prdMatchPredicate.Invoke(tItem))
					return tItem;
			return default(T);
		}

		/// <summary>
		/// Swap the items at the given indices.
		/// </summary>
		/// <typeparam name="T">The type of object in the list.</typeparam>
		/// <param name="p_lstList">The list containing the ittems to be swapped..</param>
		/// <param name="p_intIndexA">The index of the first item to swap positions.</param>
		/// <param name="p_intIndexB">The index of the second item to swap positions.</param>
		public static void Swap<T>(this IList<T> p_lstList, Int32 p_intIndexA, Int32 p_intIndexB)
		{
			T tTmp = p_lstList[p_intIndexA];
			p_lstList[p_intIndexA] = p_lstList[p_intIndexB];
			p_lstList[p_intIndexB] = tTmp;
		}

		/// <summary>
		/// Determines if the list contains an item that matches the given predicate.
		/// </summary>
		/// <typeparam name="T">The type of object in the list.</typeparam>
		/// <param name="p_lstList">The list to search.</param>
		/// <param name="p_prdMatchPredicate">The <see cref="Predicate{T}"/> against which to match the list
		/// items.</param>
		/// <returns><c>true</c> if the list contains an item that matches the given predicate;
		/// <c>false</c> otherwise.</returns>
		public static bool Contains<T>(this IList<T> p_lstList, Predicate<T> p_prdMatchPredicate)
		{
			return (Find(p_lstList, p_prdMatchPredicate) != null);
		}

		/// <summary>
		/// Determines if the list contains an item that matches the value, using the given comparer.
		/// </summary>
		/// <typeparam name="T">The type of object in the list.</typeparam>
		/// <param name="p_lstList">The list to search.</param>
		/// <param name="p_tValue">The value to search for.</param>
		/// <param name="p_cmpComparer">The comparer to use to match values.</param>
		/// <returns><c>true</c> if the list contains an item that matches the given value;
		/// <c>false</c> otherwise.</returns>
		public static bool Contains<T>(this IList<T> p_lstList, T p_tValue, IEqualityComparer p_cmpComparer)
		{			
			foreach (T tItem in p_lstList)
				if (p_cmpComparer.Equals(tItem, p_tValue))
					return true;
			return false;
		}

		/// <summary>
		/// Removes the given item from the list, using the given <see cref="IEqualityComparer{T}"/>
		/// to find the given item in the list.
		/// </summary>
		/// <typeparam name="T">The type of object in the list.</typeparam>
		/// <param name="p_lstList">The list to search.</param>
		/// <param name="p_tItem">The item to remove from the list.</param>
		/// <param name="p_cmpComparer">The <see cref="IEqualityComparer{T}"/>
		/// to use to find the given item in the list.</param>
		/// <returns><c>true</c> if the item was removed from the list;
		/// <c>false</c> otherwise.</returns>
		public static bool Remove<T>(this IList<T> p_lstList, T p_tItem, IEqualityComparer<T> p_cmpComparer)
		{
			for (Int32 i = p_lstList.Count - 1; i >= 0; i--)
				if (p_cmpComparer.Equals(p_tItem, p_lstList[i]))
				{
					p_lstList.RemoveAt(i);
					return true;
				}
			return false;
		}

		/// <summary>
		/// Removes the items from the list that match the given predicate.
		/// </summary>
		/// <typeparam name="T">The type of object in the list.</typeparam>
		/// <param name="p_lstList">The list to search.</param>
		/// <param name="p_prdComparer">The predicate
		/// to use to determine which items are to be removed.</param>
		public static void RemoveAll<T>(this IList<T> p_lstList, Predicate<T> p_prdComparer)
		{
			for (Int32 i = p_lstList.Count - 1; i >= 0; i--)
				if (p_prdComparer(p_lstList[i]))
					p_lstList.RemoveAt(i);
		}

		/// <summary>
		/// Removes the items in the given enumeration from the list.
		/// </summary>
		/// <typeparam name="T">The type of object in the list.</typeparam>
		/// <param name="p_lstList">The list to search.</param>
		/// <param name="p_enmItemsToRemove">The items to remove.</param>
		public static void RemoveRange<T>(this IList<T> p_lstList, IEnumerable<T> p_enmItemsToRemove)
		{
			foreach (T tItem in p_enmItemsToRemove)
				p_lstList.Remove(tItem);
		}

		/// <summary>
		/// Removes the items in the given enumeration from the list.
		/// </summary>
		/// <typeparam name="T">The type of object in the list.</typeparam>
		/// <param name="p_lstList">The list to search.</param>
		/// <param name="p_enmItemsToRemove">The items to remove.</param>
		/// <param name="p_cmpComparer">The <see cref="IEqualityComparer{T}"/>
		/// to use to find the given items in the list.</param>
		public static void RemoveRange<T>(this IList<T> p_lstList, IEnumerable<T> p_enmItemsToRemove, IEqualityComparer<T> p_cmpComparer)
		{
			foreach (T tItem in p_enmItemsToRemove)
				p_lstList.Remove(tItem, p_cmpComparer);
		}

		/// <summary>
		/// Determines the index of the given item, using the given <see cref="IEqualityComparer{T}"/>
		/// to find the given item in the list.
		/// </summary>
		/// <typeparam name="T">The type of object in the list.</typeparam>
		/// <param name="p_lstList">The list to search.</param>
		/// <param name="p_tItem">The item to search for.</param>
		/// <param name="p_cmpComparer">The <see cref="IEqualityComparer{T}"/>
		/// to use to find the given item in the list.</param>
		/// <returns>The index of the given item in the list, or -1 if the item
		/// is not in the list.</returns>
		public static Int32 IndexOf<T>(this IList<T> p_lstList, T p_tItem, IEqualityComparer<T> p_cmpComparer)
		{
			Int32 intCount = p_lstList.Count;
			for (Int32 i = 0; i < intCount; i++)
				if (p_cmpComparer.Equals(p_tItem, p_lstList[i]))
					return i;
			return -1;
		}

		/// <summary>
		/// Determines the index of the first item matching the given predicate.
		/// </summary>
		/// <typeparam name="T">The type of object in the list.</typeparam>
		/// <param name="p_lstList">The list to search.</param>
		/// <param name="p_prdComparer">The predicate
		/// to use to find the matching item.</param>
		/// <returns>The index of the first item matching the given predicate.</returns>
		public static Int32 IndexOf<T>(this IList<T> p_lstList, Predicate<T> p_prdComparer)
		{
			Int32 intCount = p_lstList.Count;
			for (Int32 i = 0; i < intCount; i++)
				if (p_prdComparer(p_lstList[i]))
					return i;
			return -1;
		}

		/// <summary>
		/// Determines if the list is <c>null</c> or empty.
		/// </summary>
		/// <typeparam name="T">The type of object in the list.</typeparam>
		/// <param name="p_lstList">The list to examine.</param>
		/// <returns><c>true</c> if the list is <c>null</c> or empty;
		/// <c>false</c> otherwise.</returns>
		public static bool IsNullOrEmpty<T>(this IList<T> p_lstList)
		{
			if (p_lstList == null)
				return true;
			return p_lstList.Count == 0;
		}
	}
}
