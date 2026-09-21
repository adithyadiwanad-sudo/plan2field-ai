import os,pytest
@pytest.mark.models
@pytest.mark.skipif(os.environ.get('RUN_MODEL_TESTS')!='1',reason='Set RUN_MODEL_TESTS=1 after explicit model download')
def test_real_models():
    from embeddings import embed,models
    vector=embed('Erect spools on line 24');assert len(vector)==384
    scores=models()[1].predict([('Spool erection on line 24','Erect spools on line 24'),('Spool erection on line 24','Pour concrete foundation')])
    assert len(scores)==2 and scores[0]>scores[1]
