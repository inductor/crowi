'use strict'

/**
 * Commit c7b78c4 made Page.path unique.
 * This migration script removes duplicate documents from page collection, and
 *   create index within it.
 */

const { connection: db } = require('mongoose')
const assert = require('assert')

const Activity = db.collection('activities')
const Attachment = db.collection('attachments')
const Bookmark = db.collection('bookmarks')
const Backlink = db.collection('backlinks')
const Comment = db.collection('comments')
const Notification = db.collection('notifications')
const Page = db.collection('pages')
const Share = db.collection('shares')
const Watcher = db.collection('watchers')

// Extract from schema by schema.prototype.indexes
const targetCreateIndexOption = [{ path: 1 }, { unique: true, background: true }]

async function process() {
  // get duplicates
  const dups = await Page.aggregate([
    { $sort: { _id: -1 } },
    { $group: { _id: '$path', count: { $sum: 1 }, seen: { $push: { id: '$_id', count: { $size: '$seenUsers' } } } } },
    { $match: { count: { $gt: 1 } } },
  ]).toArray()
  const count = dups.reduce((pv, d) => pv + d.count, 0)

  if (count === 0) return

  console.log(`There are ${count} documents for ${dups.length} paths.`)

  /**
   * Remove duplicates with no seenUsers
   * If no seenUsers, there are no information to hold.
   */
  const removableIds = []
  for (const d of dups) {
    const ids = d.seen.filter(s => s.count === 0).map(s => s.id)
    /**
     * If all documents have no seenUsers.
     *   ... Is it possible to make this situation?
     */
    if (ids.length === d.count) ids.pop()
    removableIds.push(...ids)
  }
  await Page.deleteMany({
    _id: { $in: removableIds },
  })

  /**
   * Check and merge documents duplicated that were watched by someone
   */
  const mergePaths = dups.filter(d => d.seen.filter(s => s.count !== 0).length > 0).map(d => d._id)
  if (mergePaths.length === 0) return
  console.dir(mergePaths)
  const set = await Page.aggregate([
    { $match: { path: { $in: mergePaths } } },
    {
      $group: {
        // group by path
        _id: '$path',
        // decide write target
        mergeTarget: { $first: '$_id' },
        // decide remove targets
        allIds: { $push: '$_id' },
        // get fields that will be merged
        seenUsers: { $push: '$seenUsers' },
        grantedUsers: { $push: '$grantedUsers' },
        commentCount: { $sum: '$commentCount' },
        liker: { $push: '$liker' },
      },
    },
    {
      $project: {
        mergeTarget: 1,
        seenUsers: 1,
        grantedUsers: 1,
        commentCount: 1,
        liker: 1,
        allIds: 1,
        removeTargets: {
          $filter: {
            input: '$allIds',
            as: 'id',
            cond: { $ne: ['$$id', '$mergeTarget'] },
          },
        },
      },
    },
  ]).toArray()

  for (const t of set) {
    const { mergeTarget, removeTargets } = t

    const updateQuery = {
      $set: {
        commentCount: t.commentCount,
      },
      $addToSet: {
        seenUsers: {
          $each: t.seenUsers.reduce((p, c) => [...p, ...c], []),
        },
        grantedUsers: {
          $each: t.grantedUsers.reduce((p, c) => [...p, ...c], []),
        },
        liker: {
          $each: t.liker.reduce((p, c) => [...p, ...c], []),
        },
      },
    }

    await Page.update({ _id: mergeTarget }, updateQuery)
    await Page.remove({ _id: { $in: removeTargets } })

    // update documents relative to removed pages
    const inRemoveTargets = { $in: removeTargets }
    await Activity.update(
      {
        targetModel: 'Page',
        target: inRemoveTargets,
      },
      {
        $set: {
          target: mergeTarget,
        },
      },
    )
    await Attachment.update(
      {
        page: inRemoveTargets,
      },
      {
        $set: {
          page: mergeTarget,
        },
      },
    )
    await Bookmark.update(
      {
        page: inRemoveTargets,
      },
      {
        $set: {
          page: mergeTarget,
        },
      },
    )
    await Backlink.update(
      {
        page: inRemoveTargets,
      },
      {
        $set: {
          page: mergeTarget,
        },
      },
    )
    await Notification.update(
      {
        targetModel: 'Page',
        target: inRemoveTargets,
      },
      {
        $set: {
          target: mergeTarget,
        },
      },
    )
    await Comment.update(
      {
        page: inRemoveTargets,
      },
      {
        $set: {
          page: mergeTarget,
        },
      },
    )
    await Share.update(
      {
        page: inRemoveTargets,
      },
      {
        $set: {
          page: mergeTarget,
        },
      },
    )
    await Watcher.update(
      {
        targetModel: 'Page',
        target: inRemoveTargets,
      },
      {
        $set: {
          target: mergeTarget,
        },
      },
    )
  }
}

module.exports.up = async function() {
  const indexes = await Page.indexInformation({ full: true })

  // Skip when there are already index that equals targetCreateIndexOption
  const filterWithCreateIndexOption = (key, option) => actualIndex => {
    try {
      const { key: actualKey } = actualIndex
      assert.deepStrictEqual(actualKey, key)
      const actualOption = Object.keys(option).reduce((o, k) => {
        o[k] = actualIndex[k]
        return o
      }, {})
      assert.deepStrictEqual(actualOption, option)
      return true
    } catch (_) {
      return false
    }
  }
  if (indexes.find(filterWithCreateIndexOption(...targetCreateIndexOption))) return

  await process()
  await Page.createIndex(...targetCreateIndexOption)
}

module.exports.down = function(next) {
  next()
}