import Crowi from 'server/crowi'

export default (crowi: Crowi) => {
  // var debug = Debug('crowi:routes:backlink')
  const Backlink = crowi.model('Backlink')
  const ApiResponse = require('../util/apiResponse')
  const actions = {} as any
  actions.api = {} as any

  /**
   * @api {list} /backlink.list Get list backlinks of the page
   * @apiName ListBackLink
   * @apiGroup Backlink
   *
   * @apiParam {String} page_id Page Id.
   * @apiParam {Number} limit
   * @apiParam {Number} offset
   */
  actions.api.list = function(req, res) {
    const pageId = req.query.page_id
    const limit = req.query.limit || 10
    const offset = req.query.offset || 0

    Backlink.findByPageId(pageId, limit, offset)
      .then(backlinks => {
        var result = {
          data: backlinks,
        }
        return res.json(ApiResponse.success(result))
      })
      .catch(err => {
        return res.json(ApiResponse.error(err))
      })
  }

  return actions
}